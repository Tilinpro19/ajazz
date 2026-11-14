// Detecta el .exe de la ventana en primer plano y avisa a la UI cuando cambia.
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use windows::core::PWSTR;
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION};
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

#[derive(Default)]
pub struct Watcher {
    running: Arc<AtomicBool>,
}

fn foreground_exe() -> Option<String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 520];
        let mut len = buf.len() as u32;
        let r = QueryFullProcessImageNameW(h, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len);
        let _ = CloseHandle(h);
        r.ok()?;
        let full = String::from_utf16_lossy(&buf[..len as usize]);
        full.rsplit('\\').next().map(str::to_string)
    }
}

impl Watcher {
    pub fn set(&self, app: &AppHandle, enabled: bool) {
        if !enabled {
            self.running.store(false, Ordering::Relaxed);
            return;
        }
        if self.running.swap(true, Ordering::Relaxed) {
            return;
        }
        let (app, running) = (app.clone(), self.running.clone());
        let own = std::env::current_exe().ok().and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_lowercase()));
        std::thread::spawn(move || {
            let mut last = String::new();
            while running.load(Ordering::Relaxed) {
                if let Some(exe) = foreground_exe() {
                    // Al volver a la propia app no se cambia de perfil.
                    if Some(exe.to_lowercase()) != own && exe != last {
                        last = exe.clone();
                        let _ = app.emit("foreground", exe);
                    }
                }
                std::thread::sleep(Duration::from_millis(1000));
            }
        });
    }
}
