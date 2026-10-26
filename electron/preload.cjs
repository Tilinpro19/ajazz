// Puente mínimo entre la UI y el proceso principal. El HID va directo por WebHID.
const { contextBridge, ipcRenderer } = require("electron");

const listen = (channel) => (cb) => {
  const handler = (_e, value) => cb(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld("ajazz", {
  loadStore: () => ipcRenderer.invoke("store:load"),
  saveStore: (data) => ipcRenderer.invoke("store:save", data),
  exportProfile: (data, name) => ipcRenderer.invoke("profile:export", data, name),
  importProfile: () => ipcRenderer.invoke("profile:import"),
  ensureBackup: (data) => ipcRenderer.invoke("backup:ensure", data),
  openBackups: () => ipcRenderer.invoke("backup:open"),
  appInfo: () => ipcRenderer.invoke("app:info"),
  setAutoSwitch: (enabled) => ipcRenderer.invoke("autoswitch:set", enabled),
  getAppSettings: () => ipcRenderer.invoke("settings:get"),
  setAppSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  setTrayProfile: (name) => ipcRenderer.send("tray:profile", name),
  onForeground: listen("foreground"),
  onForegroundError: listen("foreground-error"),
});
