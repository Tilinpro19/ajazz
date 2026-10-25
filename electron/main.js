// Proceso principal: ventana, permisos HID sin diálogo, bloqueo de red, perfiles en disco
// y detector de ventana activa (Windows).
import { app, BrowserWindow, session, ipcMain, dialog, Menu, shell, nativeTheme } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { VENDOR_IDS, PRODUCT_ID, USAGE_PAGE, USAGE } from "../src/protocol.js";
import { ForegroundWatcher } from "./foreground.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const STORE_FILE = () => path.join(app.getPath("userData"), "profiles.json");
const BACKUP_DIR = () => path.join(app.getPath("userData"), "respaldos");

let win = null;
const watcher = new ForegroundWatcher(path.basename(process.execPath));

const isOurDevice = (d) => VENDOR_IDS.includes(d.vendorId) && d.productId === PRODUCT_ID;
const isControlInterface = (d) => isOurDevice(d) &&
  (!d.collections || d.collections.some((c) => c.usagePage === USAGE_PAGE && c.usage === USAGE));

function setupSession(ses) {
  // Sin red: solo se permite el servidor de Vite en desarrollo.
  ses.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (details, cb) => {
    const allowed = DEV_URL && new URL(details.url).host === new URL(DEV_URL).host;
    cb({ cancel: !allowed });
  });
  ses.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
  ses.setPermissionCheckHandler((_wc, permission) => permission === "hid");
  ses.setDevicePermissionHandler((d) => d.deviceType === "hid" && isOurDevice(d.device));
  // requestDevice(): elige el mouse sin mostrar el selector.
  ses.on("select-hid-device", (event, details, callback) => {
    event.preventDefault();
    const list = details.deviceList.filter(isControlInterface);
    list.sort((a, b) => (a.vendorId === VENDOR_IDS[0] ? -1 : 1) - (b.vendorId === VENDOR_IDS[0] ? -1 : 1));
    callback(list[0]?.deviceId ?? "");
  });
}

function createWindow() {
  nativeTheme.themeSource = "dark";
  win = new BrowserWindow({
    width: 1220,
    height: 780,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: "#0e1013",
    title: "AJAZZ AJ139 Control",
    icon: path.join(here, "..", "build", "icon.png"),
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0e1219",
      symbolColor: "#94a3b8",
      height: 38,
    },
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Enlaces externos: nunca dentro de la app.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e, url) => {
    if (!(DEV_URL && url.startsWith(DEV_URL))) e.preventDefault();
  });
  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(here, "..", "dist", "index.html"), { hash: process.env.AJ_DEMO ? "demo" : "" });
  win.on("closed", () => (win = null));
}

// ---- Perfiles en disco ----

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    // Archivo dañado: se aparta para no perderlo y se arranca de cero.
    await fs.rename(file, `${file}.danado-${Date.now()}`).catch(() => {});
    return null;
  }
}

// Escritura atómica: archivo temporal + rename.
async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n");
  await fs.rename(tmp, file);
}

ipcMain.handle("store:load", () => readJson(STORE_FILE()));
ipcMain.handle("store:save", (_e, data) => writeJson(STORE_FILE(), data));

ipcMain.handle("profile:export", async (_e, data, name) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "Exportar perfil",
    defaultPath: `${(name || "perfil").replace(/[\\/:*?"<>|]/g, "_")}.aj139.json`,
    filters: [{ name: "Perfil AJ139", extensions: ["json"] }],
  });
  if (canceled || !filePath) return null;
  await writeJson(filePath, data);
  return filePath;
});

ipcMain.handle("profile:import", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: "Importar perfil",
    properties: ["openFile"],
    filters: [{ name: "Perfil AJ139", extensions: ["json"] }],
  });
  if (canceled || !filePaths[0]) return null;
  return JSON.parse(await fs.readFile(filePaths[0], "utf8"));
});

// Respaldo de las respuestas crudas del mouse antes de la primera escritura.
ipcMain.handle("backup:ensure", async (_e, data) => {
  const dir = BACKUP_DIR();
  await fs.mkdir(dir, { recursive: true });
  const existing = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  if (existing.length) return { path: path.join(dir, existing[0]), created: false };
  const file = path.join(dir, `respaldo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeJson(file, data);
  return { path: file, created: true };
});

ipcMain.handle("backup:open", () => shell.openPath(BACKUP_DIR()));

ipcMain.handle("app:info", () => ({ version: app.getVersion(), platform: process.platform }));

// ---- Cambio automático por ventana activa ----

watcher.on("change", (exe) => win?.webContents.send("foreground", exe));
watcher.on("error", (msg) => win?.webContents.send("foreground-error", msg));
ipcMain.handle("autoswitch:set", (_e, enabled) => {
  if (process.platform !== "win32") return false;
  if (enabled) watcher.start();
  else watcher.stop();
  return enabled;
});

// ---- Ciclo de vida ----

const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  if (!primary) return;
  Menu.setApplicationMenu(null);
  setupSession(session.defaultSession);
  createWindow();
});

app.on("window-all-closed", () => {
  watcher.stop();
  app.quit();
});
