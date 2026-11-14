// Imita la parte de WebHID que usa DeviceManager/HidTransport, pero por encima de los
// comandos de Rust (WebView2 no trae WebHID). El protocolo no cambia.
import { PRODUCT_ID, USAGE_PAGE, USAGE } from "../protocol.js";

class TauriHidDevice {
  constructor(tauri, info) {
    this.tauri = tauri;
    this.path = info.path;
    this.vendorId = info.vendorId;
    this.productId = info.productId ?? PRODUCT_ID;
    this.collections = [{ usagePage: USAGE_PAGE, usage: USAGE }];
    this.opened = false;
    this.handlers = new Set();
  }

  addEventListener(type, fn) {
    if (type === "inputreport") this.handlers.add(fn);
  }

  removeEventListener(type, fn) {
    if (type === "inputreport") this.handlers.delete(fn);
  }

  async open() {
    await this.tauri.core.invoke("hid_open", { path: this.path });
    this.opened = true;
  }

  async close() {
    this.opened = false;
    await this.tauri.core.invoke("hid_close", { path: this.path });
  }

  sendReport(reportId, data) {
    return this.tauri.core.invoke("hid_send", { path: this.path, reportId, data: Array.from(data) });
  }

  _report(bytes) {
    const data = new DataView(Uint8Array.from(bytes).buffer);
    for (const fn of this.handlers) fn({ reportId: 0, data });
  }
}

export class TauriHid {
  #tauri;
  #devices = new Map(); // path -> TauriHidDevice (identidad estable entre escaneos)
  #listeners = { connect: new Set(), disconnect: new Set() };

  constructor(tauri) {
    this.#tauri = tauri;
    tauri.event.listen("hid:report", (e) => this.#devices.get(e.payload.path)?._report(e.payload.data));
    tauri.event.listen("hid:changed", (e) => this.#sync(e.payload));
    // Lectura fallida: se da de baja el dispositivo y se vuelve a listar (si sigue, reconecta).
    tauri.event.listen("hid:lost", (e) => {
      const device = this.#devices.get(e.payload);
      if (device) {
        this.#devices.delete(e.payload);
        device.opened = false;
        this.#emit("disconnect", device);
      }
      this.#refresh();
    });
  }

  addEventListener(type, fn) {
    this.#listeners[type]?.add(fn);
  }

  removeEventListener(type, fn) {
    this.#listeners[type]?.delete(fn);
  }

  async getDevices() {
    await this.#refresh(false);
    return [...this.#devices.values()];
  }

  // Sin selector: el permiso no existe fuera del navegador.
  requestDevice() {
    return this.getDevices();
  }

  async #refresh(notify = true) {
    this.#sync(await this.#tauri.core.invoke("hid_list"), notify);
  }

  #sync(list, notify = true) {
    const seen = new Set(list.map((i) => i.path));
    for (const [path, device] of this.#devices) {
      if (seen.has(path)) continue;
      this.#devices.delete(path);
      device.opened = false;
      if (notify) this.#emit("disconnect", device);
    }
    for (const info of list) {
      if (this.#devices.has(info.path)) continue;
      const device = new TauriHidDevice(this.#tauri, info);
      this.#devices.set(info.path, device);
      if (notify) this.#emit("connect", device);
    }
  }

  #emit(type, device) {
    for (const fn of this.#listeners[type]) fn({ device });
  }
}
