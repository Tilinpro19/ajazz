// Acceso al proceso principal (preload). Fuera de Electron (vite en Chrome) usa
// localStorage y descargas, para poder probar la UI con WebHID del navegador.
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
  onForeground: () => () => {},
  onForegroundError: () => () => {},
};

export const api = window.ajazz ?? browserApi;
export const inElectron = Boolean(window.ajazz);
