// Puente de bytes con el mouse. Todo el protocolo vive en JS; aquí solo se abre la
// interfaz de control, se escriben frames y se reenvían los reportes de entrada.
use hidapi::{HidApi, HidDevice};
use serde::Serialize;
use std::collections::HashMap;
use std::ffi::CString;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const VENDOR_IDS: [u16; 2] = [43172, 43173]; // cable USB, dongle 2.4G
const PRODUCT_ID: u16 = 8789;
const USAGE_PAGE: u16 = 65281;
const USAGE: u16 = 16;

#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DevInfo {
    path: String,
    vendor_id: u16,
    product_id: u16,
}

#[derive(Serialize, Clone)]
struct Report {
    path: String,
    data: Vec<u8>,
}

struct Opened {
    writer: HidDevice,
    stop: Arc<AtomicBool>,
}

pub struct Hid {
    api: Mutex<HidApi>,
    open: Mutex<HashMap<String, Opened>>,
}

impl Hid {
    pub fn new() -> Result<Self, String> {
        Ok(Self { api: Mutex::new(HidApi::new().map_err(|e| e.to_string())?), open: Mutex::default() })
    }

    pub fn list(&self) -> Vec<DevInfo> {
        let mut api = self.api.lock().unwrap();
        if api.refresh_devices().is_err() {
            return vec![];
        }
        api.device_list()
            .filter(|d| {
                VENDOR_IDS.contains(&d.vendor_id())
                    && d.product_id() == PRODUCT_ID
                    && d.usage_page() == USAGE_PAGE
                    && d.usage() == USAGE
            })
            .map(|d| DevInfo {
                path: d.path().to_string_lossy().into_owned(),
                vendor_id: d.vendor_id(),
                product_id: d.product_id(),
            })
            .collect()
    }

    fn open(&self, app: &AppHandle, path: &str) -> Result<(), String> {
        if self.open.lock().unwrap().contains_key(path) {
            return Ok(());
        }
        let cpath = CString::new(path).map_err(|e| e.to_string())?;
        let (reader, writer) = {
            let api = self.api.lock().unwrap();
            let r = api.open_path(&cpath).map_err(|e| e.to_string())?;
            let w = api.open_path(&cpath).map_err(|e| e.to_string())?;
            (r, w)
        };
        let stop = Arc::new(AtomicBool::new(false));
        self.open.lock().unwrap().insert(path.to_string(), Opened { writer, stop: stop.clone() });

        let (app, path) = (app.clone(), path.to_string());
        std::thread::spawn(move || {
            let mut buf = [0u8; 65];
            while !stop.load(Ordering::Relaxed) {
                match reader.read_timeout(&mut buf, 250) {
                    Ok(0) => {}
                    Ok(n) => {
                        let _ = app.emit("hid:report", Report { path: path.clone(), data: buf[..n].to_vec() });
                    }
                    Err(_) => {
                        if !stop.load(Ordering::Relaxed) {
                            app.state::<Hid>().open.lock().unwrap().remove(&path);
                            let _ = app.emit("hid:lost", path.clone());
                        }
                        break;
                    }
                }
            }
        });
        Ok(())
    }

    fn close(&self, path: &str) {
        if let Some(o) = self.open.lock().unwrap().remove(path) {
            o.stop.store(true, Ordering::Relaxed);
        }
    }

    fn send(&self, path: &str, report_id: u8, data: &[u8]) -> Result<(), String> {
        let open = self.open.lock().unwrap();
        let o = open.get(path).ok_or("dispositivo no abierto")?;
        let mut frame = Vec::with_capacity(data.len() + 1);
        frame.push(report_id);
        frame.extend_from_slice(data);
        o.writer.write(&frame).map(|_| ()).map_err(|e| e.to_string())
    }
}

// Avisa a la UI cuando aparece o desaparece el mouse (cable o dongle).
pub fn start_poller(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last: Vec<DevInfo> = app.state::<Hid>().list();
        loop {
            std::thread::sleep(Duration::from_secs(2));
            let now = app.state::<Hid>().list();
            if now != last {
                let _ = app.emit("hid:changed", now.clone());
                last = now;
            }
        }
    });
}

#[tauri::command]
pub fn hid_list(hid: tauri::State<Hid>) -> Vec<DevInfo> {
    hid.list()
}

#[tauri::command]
pub fn hid_open(app: AppHandle, hid: tauri::State<Hid>, path: String) -> Result<(), String> {
    hid.open(&app, &path)
}

#[tauri::command]
pub fn hid_close(hid: tauri::State<Hid>, path: String) {
    hid.close(&path)
}

#[tauri::command]
pub fn hid_send(hid: tauri::State<Hid>, path: String, report_id: u8, data: Vec<u8>) -> Result<(), String> {
    hid.send(&path, report_id, &data)
}
