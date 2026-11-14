// Acceso al proceso principal (preload). Fuera de Electron (vite en Chrome) usa
// localStorage y descargas, para poder probar la UI con WebHID del navegador.
import { TauriHid } from "../device/tauriHid.js";

const KEY = "aj139-store";

const browserApi = {
  loadStore: async () => JSON.parse(localStorage.getItem(KEY) || "null"),
  saveStore: async (data) => localStorage.setItem(KEY, JSON.stringify(data)),
  exportProfile: async (data, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `${name || "perfil"}.aj139.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return a.download;
  },
  importProfile: () => new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      try {
        resolve(input.files[0] ? JSON.parse(await input.files[0].text()) : null);
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  }),
  ensureBackup: async (data) => {
    const k = `${KEY}-backup`;
    if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(data));
    return { path: "localStorage", created: false };
  },
  openBackups: async () => {},
  appInfo: async () => ({ version: "dev", platform: "browser" }),
  setAutoSwitch: async () => false,
  getAppSettings: async () => null,
  setAppSettings: async () => null,
  setTrayProfile: () => {},
  onForeground: () => () => {},
  onForegroundError: () => () => {},
};

// Tauri: mismos nombres que el preload de Electron, sobre invoke/listen.
const T = window.__TAURI__;
const tauriApi = T && {
  loadStore: () => T.core.invoke("store_load"),
  saveStore: (data) => T.core.invoke("store_save", { data }),
  exportProfile: (data, name) => T.core.invoke("profile_export", { data, name }),
  importProfile: () => T.core.invoke("profile_import"),
  ensureBackup: (data) => T.core.invoke("backup_ensure", { data }),
  openBackups: () => T.core.invoke("backup_open"),
  appInfo: () => T.core.invoke("app_info"),
  setAutoSwitch: (enabled) => T.core.invoke("autoswitch_set", { enabled }),
  getAppSettings: () => T.core.invoke("settings_get"),
  setAppSettings: (patch) => T.core.invoke("settings_set", { patch }),
  setTrayProfile: (name) => { T.core.invoke("tray_profile", { name: name || "" }); },
  onForeground: (cb) => listen(T, "foreground", cb),
  onForegroundError: () => () => {},
};

function listen(T, event, cb) {
  const un = T.event.listen(event, (e) => cb(e.payload));
  return () => un.then((f) => f());
}

export const api = window.ajazz ?? tauriApi ?? browserApi;
export const inElectron = Boolean(window.ajazz || T);
export const inTauri = Boolean(T);
// Controles de ventana propios (Tauri sin marco). En Electron los pone el overlay del sistema.
export const windowControls = T && {
  minimize: () => T.window.getCurrentWindow().minimize(),
  toggleMaximize: () => T.window.getCurrentWindow().toggleMaximize(),
  close: () => T.window.getCurrentWindow().close(),
};
export const tauriHid = T ? new TauriHid(T) : null;
