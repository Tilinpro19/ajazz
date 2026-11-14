// Proceso principal (Tauri): ventana, bandeja, perfiles en disco, ajustes, inicio con Windows
// y detector de ventana activa. El HID está en hid.rs; el protocolo vive en la UI (JS).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod foreground;
mod hid;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder};
use tauri::{AppHandle, Manager, State, WindowEvent};

const DATA_DIR: &str = "AJAZZ AJ139 Control"; // misma carpeta que usaba la versión Electron
const HIDDEN_ARG: &str = "--hidden";
const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
struct Settings {
    close_to_tray: bool,
    start_with_windows: bool,
    start_minimized: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self { close_to_tray: true, start_with_windows: false, start_minimized: true }
    }
}

struct App {
    settings: Mutex<Settings>,
    profile_item: MenuItem<tauri::Wry>,
    quitting: AtomicBool,
    watcher: foreground::Watcher,
}

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().data_dir().unwrap_or_else(|_| PathBuf::from(".")).join(DATA_DIR)
}

fn now_millis() -> u128 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
}

fn read_json(file: &Path) -> Option<Value> {
    let text = std::fs::read_to_string(file).ok()?;
    match serde_json::from_str(&text) {
        Ok(v) => Some(v),
        Err(_) => {
            // Archivo dañado: se aparta para no perderlo y se arranca de cero.
            let _ = std::fs::rename(file, format!("{}.danado-{}", file.display(), now_millis()));
            None
        }
    }
}

// Escritura atómica: archivo temporal + rename.
fn write_json(file: &Path, data: &Value) -> Result<(), String> {
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = PathBuf::from(format!("{}.tmp", file.display()));
    let text = serde_json::to_string_pretty(data).map_err(|e| e.to_string())? + "\n";
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, file).map_err(|e| e.to_string())
}

fn show_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn apply_login_item(enabled: bool) {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};
    let Ok((key, _)) = RegKey::predef(HKEY_CURRENT_USER).create_subkey(RUN_KEY) else { return };
    if enabled {
        if let Ok(exe) = std::env::current_exe() {
            let _ = key.set_value(DATA_DIR, &format!("\"{}\" {HIDDEN_ARG}", exe.display()));
        }
    } else {
        let _ = key.delete_value(DATA_DIR);
    }
}

// ---- Comandos (equivalen a los canales IPC del preload de Electron) ----

#[tauri::command]
fn store_load(app: AppHandle) -> Option<Value> {
    read_json(&data_dir(&app).join("profiles.json"))
}

#[tauri::command]
fn store_save(app: AppHandle, data: Value) -> Result<(), String> {
    write_json(&data_dir(&app).join("profiles.json"), &data)
}

#[tauri::command]
async fn profile_export(data: Value, name: Option<String>) -> Result<Option<String>, String> {
    let base: String = name
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| "perfil".into())
        .chars()
        .map(|c| if "\\/:*?\"<>|".contains(c) { '_' } else { c })
        .collect();
    let Some(path) = rfd::FileDialog::new()
        .set_title("Exportar perfil")
        .set_file_name(format!("{base}.aj139.json"))
        .add_filter("Perfil AJ139", &["json"])
        .save_file()
    else {
        return Ok(None);
    };
    write_json(&path, &data)?;
    Ok(Some(path.display().to_string()))
}

#[tauri::command]
async fn profile_import() -> Result<Option<Value>, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("Importar perfil")
        .add_filter("Perfil AJ139", &["json"])
        .pick_file()
    else {
        return Ok(None);
    };
    let text = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map(Some).map_err(|e| e.to_string())
}

// Respaldo de las respuestas crudas del mouse antes de la primera escritura.
#[tauri::command]
fn backup_ensure(app: AppHandle, data: Value) -> Result<Value, String> {
    let dir = data_dir(&app).join("respaldos");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut existing: Vec<PathBuf> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "json"))
        .collect();
    existing.sort();
    if let Some(first) = existing.first() {
        return Ok(json!({ "path": first.display().to_string(), "created": false }));
    }
    let file = dir.join(format!("respaldo-{}.json", now_millis()));
    write_json(&file, &data)?;
    Ok(json!({ "path": file.display().to_string(), "created": true }))
}

#[tauri::command]
fn backup_open(app: AppHandle) {
    let dir = data_dir(&app).join("respaldos");
    let _ = std::fs::create_dir_all(&dir);
    let _ = std::process::Command::new("explorer").arg(dir).spawn();
}

#[tauri::command]
fn app_info(app: AppHandle) -> Value {
    json!({ "version": app.package_info().version.to_string(), "platform": "win32" })
}

#[tauri::command]
fn autoswitch_set(app: AppHandle, state: State<App>, enabled: bool) -> bool {
    state.watcher.set(&app, enabled);
    enabled
}

#[tauri::command]
fn settings_get(state: State<App>) -> Settings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn settings_set(app: AppHandle, state: State<App>, patch: Value) -> Result<Settings, String> {
    let mut s = state.settings.lock().unwrap();
    let mut merged = serde_json::to_value(&*s).map_err(|e| e.to_string())?;
    if let (Some(m), Some(p)) = (merged.as_object_mut(), patch.as_object()) {
        for (k, v) in p {
            m.insert(k.clone(), v.clone());
        }
    }
    *s = serde_json::from_value(merged).map_err(|e| e.to_string())?;
    write_json(&data_dir(&app).join("app-settings.json"), &serde_json::to_value(&*s).unwrap())?;
    if patch.get("startWithWindows").is_some() {
        apply_login_item(s.start_with_windows);
    }
    Ok(s.clone())
}

#[tauri::command]
fn tray_profile(app: AppHandle, state: State<App>, name: String) {
    let _ = state.profile_item.set_text(format!("Perfil: {}", if name.is_empty() { "—" } else { &name }));
    if let Some(tray) = app.tray_by_id("main") {
        let tip = if name.is_empty() { "AJAZZ AJ139 Control".to_string() } else { format!("AJAZZ AJ139 Control · {name}") };
        let _ = tray.set_tooltip(Some(tip));
    }
}

fn main() {
    let hid = hid::Hid::new().expect("no se pudo iniciar HID");
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_window(app)))
        .manage(hid)
        .invoke_handler(tauri::generate_handler![
            hid::hid_list,
            hid::hid_open,
            hid::hid_close,
            hid::hid_send,
            store_load,
            store_save,
            profile_export,
            profile_import,
            backup_ensure,
            backup_open,
            app_info,
            autoswitch_set,
            settings_get,
            settings_set,
            tray_profile,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let settings: Settings = read_json(&data_dir(&handle).join("app-settings.json"))
                .and_then(|v| serde_json::from_value(v).ok())
                .unwrap_or_default();

            let open = MenuItem::with_id(app, "open", "Abrir", true, None::<&str>)?;
            let profile_item = MenuItem::with_id(app, "profile", "Perfil: —", false, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&open, &profile_item, &sep, &quit])?;
            TrayIconBuilder::with_id("main")
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/128x128.png"))?)
                .tooltip("AJAZZ AJ139 Control")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, ev| match ev.id.as_ref() {
                    "open" => show_window(app),
                    "quit" => {
                        app.state::<App>().quitting.store(true, Ordering::Relaxed);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, ev| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = ev
                    {
                        show_window(tray.app_handle());
                    }
                })
                .build(app)?;

            let start_hidden = std::env::args().any(|a| a == HIDDEN_ARG) && settings.start_minimized;
            app.manage(App {
                settings: Mutex::new(settings),
                profile_item,
                quitting: AtomicBool::new(false),
                watcher: foreground::Watcher::default(),
            });
            if !start_hidden {
                show_window(&handle);
            }
            hid::start_poller(handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let st = window.app_handle().state::<App>();
                if !st.quitting.load(Ordering::Relaxed) && st.settings.lock().unwrap().close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar la app");
}
