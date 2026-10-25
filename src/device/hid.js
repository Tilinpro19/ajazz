// Transporte WebHID: cola FIFO (una petición a la vez), timeout con reintento,
// validación de respuestas y reconexión automática (USB o dongle).
// No depende del DOM: recibe `navigator.hid` (o un mock en las pruebas).
import { VENDOR_IDS, PRODUCT_ID, USAGE_PAGE, USAGE, isValidResponse, decodeUnsolicited } from "../protocol.js";

export const USB_VENDOR = VENDOR_IDS[0];

export const HID_FILTERS = VENDOR_IDS.map((vendorId) => ({ vendorId, productId: PRODUCT_ID, usagePage: USAGE_PAGE, usage: USAGE }));

// Emisor mínimo de eventos (sirve igual en Node y en el navegador).
export class Emitter {
  #handlers = new Map();
  on(name, fn) {
    if (!this.#handlers.has(name)) this.#handlers.set(name, new Set());
    this.#handlers.get(name).add(fn);
    return () => this.#handlers.get(name)?.delete(fn);
  }
  emit(name, value) {
    for (const fn of this.#handlers.get(name) || []) fn(value);
  }
}

const toBytes = (dataView) => new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);

export class TimeoutError extends Error {}

export class HidTransport extends Emitter {
  constructor(device, { timeout = 1000, retries = 1 } = {}) {
    super();
    this.device = device;
    this.timeout = timeout;
    this.retries = retries;
    this.queue = [];
    this.current = null;
    this.closed = false;
    this.onReport = (e) => this.#handleReport(e.reportId ?? 0, toBytes(e.data));
    device.addEventListener("inputreport", this.onReport);
  }

  async open() {
    if (!this.device.opened) await this.device.open();
  }

  async close() {
    this.closed = true;
    this.device.removeEventListener("inputreport", this.onReport);
    for (const job of this.queue.splice(0)) job.reject(new Error("dispositivo desconectado"));
    if (this.current) this.current.fail(new Error("dispositivo desconectado"));
    try {
      if (this.device.opened) await this.device.close();
    } catch { /* ya estaba cerrado */ }
  }

  // Envía un frame de 65 bytes (Report ID en [0]) y espera la respuesta `aa <cmd>`.
  // `validate` exige además el checksum (confirmado en las respuestas de lectura).
  request(frame, { command = frame[2], validate = false } = {}) {
    if (this.closed) return Promise.reject(new Error("dispositivo desconectado"));
    return new Promise((resolve, reject) => {
      this.queue.push({ frame, command, validate, resolve, reject });
      if (!this.current) this.#next();
    });
  }

  async #next() {
    const job = this.queue.shift();
    if (!job) return;
    const payload = new Uint8Array(64);
    payload.set(job.frame.slice(1, 65));
    let settled = false;
    let wake = () => {};
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      wake();
      this.current = null;
      fn(value);
      this.#next();
    };
    this.current = {
      matches: (r) => r[0] === 0xaa && r[1] === job.command && (!job.validate || isValidResponse(r, job.command)),
      done: (r) => finish(job.resolve, r),
      fail: (err) => finish(job.reject, err),
    };
    for (let attempt = 0; attempt <= this.retries && !settled; attempt++) {
      try {
        await this.device.sendReport(job.frame[0], payload);
      } catch (err) {
        return finish(job.reject, err);
      }
      if (settled) break;
      await new Promise((res) => {
        const t = setTimeout(res, this.timeout);
        wake = () => { clearTimeout(t); res(); };
      });
    }
    finish(job.reject, new TimeoutError(`sin respuesta al comando 0x${job.command.toString(16)}`));
  }

  #handleReport(reportId, data) {
    const r = Array.from(data);
    const unsolicited = decodeUnsolicited(r);
    if (unsolicited) return this.emit("unsolicited", unsolicited);
    // Respuestas tardías o de otro comando: se ignoran (la cola solo acepta la que espera).
    if (this.current?.matches(r)) this.current.done(r);
  }
}

const isControlInterface = (d) =>
  VENDOR_IDS.includes(d.vendorId) && d.productId === PRODUCT_ID &&
  (d.collections || []).some((c) => c.usagePage === USAGE_PAGE && c.usage === USAGE);

// Prefiere el cable si están conectados los dos.
const pick = (devices) => devices.filter(isControlInterface).sort((a, b) => (a.vendorId === USB_VENDOR ? -1 : 1) - (b.vendorId === USB_VENDOR ? -1 : 1))[0];

// Busca el mouse, lo abre y avisa con "change" cuando se conecta o desconecta.
// Estados: { status: "searching" } | { status: "connected", device, transport, mode } | { status: "error", error }.
export class DeviceManager extends Emitter {
  constructor(hid, options = {}) {
    super();
    this.hid = hid;
    this.options = options;
    this.state = { status: "searching" };
    this.busy = false;
    this.rescan = false;
  }

  async start() {
    this.hid.addEventListener("connect", () => this.scan());
    this.hid.addEventListener("disconnect", (e) => {
      if (this.state.device && e.device === this.state.device) this.#drop();
    });
    await this.scan();
  }

  // Pide permiso con el selector (en Electron lo resuelve main.js sin diálogo).
  async request() {
    let devices = [];
    try {
      devices = await this.hid.requestDevice({ filters: HID_FILTERS });
    } catch (err) {
      if (err?.name !== "NotFoundError") throw err; // sin dispositivo / selector cancelado
    }
    const device = pick(devices);
    if (!device) throw new Error("No se encontró el mouse. Revisa el cable USB o el dongle 2.4G.");
    await this.#connect(device);
  }

  async scan() {
    if (this.busy) {
      this.rescan = true; // se repite al terminar la conexión en curso
      return;
    }
    const devices = await this.hid.getDevices();
    const best = pick(devices);
    if (!best) {
      if (this.state.status === "connected") await this.#drop();
      return;
    }
    if (this.state.status === "connected" && this.state.device === best) return;
    if (this.state.status === "connected") {
      const { transport } = this.state;
      this.#set({ status: "searching" });
      await transport?.close();
    }
    await this.#connect(best);
  }

  async #connect(device) {
    if (!device || this.state.status === "connected") return;
    this.busy = true;
    try {
      const transport = new HidTransport(device, this.options);
      await transport.open();
      this.#set({ status: "connected", device, transport, mode: device.vendorId === USB_VENDOR ? "USB" : "2.4G" });
    } catch (error) {
      this.#set({ status: "error", error });
    } finally {
      this.busy = false;
      if (this.rescan) {
        this.rescan = false;
        this.scan().catch(() => {});
      }
    }
  }

  async #drop() {
    const { transport } = this.state;
    this.#set({ status: "searching" });
    await transport?.close();
    await this.scan(); // puede quedar el otro modo (p. ej. se desconectó el cable y sigue el dongle)
  }

  #set(state) {
    this.state = state;
    this.emit("change", state);
  }
}
