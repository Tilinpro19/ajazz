// Capa de dispositivo con un HID simulado: nunca toca el mouse real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HidTransport, DeviceManager, TimeoutError } from "../src/device/hid.js";
import { Mouse } from "../src/device/mouse.js";
import { cmd, responseChecksum, FACTORY_BUTTONS } from "../src/protocol.js";

// Respuesta 0xAA con checksum correcto para un comando y unos datos.
function reply(command, data = [], { len = data.length, extra = {} } = {}) {
  const r = Array(64).fill(0);
  r[0] = 0xaa; r[1] = command; r[4] = len;
  data.forEach((b, i) => (r[8 + i] = b));
  for (const [i, v] of Object.entries(extra)) r[i] = v;
  r[3] = responseChecksum(r);
  return r;
}

class FakeDevice extends EventTarget {
  constructor({ vendorId = 43172, usage = 16, respond } = {}) {
    super();
    this.vendorId = vendorId;
    this.productId = 8789;
    this.collections = [{ usagePage: 65281, usage }];
    this.opened = false;
    this.sent = [];
    this.respond = respond ?? ((payload) => [reply(payload[1])]);
  }
  async open() { this.opened = true; }
  async close() { this.opened = false; }
  async sendReport(reportId, payload) {
    this.sent.push([reportId, ...payload]);
    const out = this.respond(payload) || [];
    setTimeout(() => out.forEach((r) => this.push(r)), 1);
  }
  push(r) {
    const e = new Event("inputreport");
    e.reportId = 0;
    e.data = new DataView(Uint8Array.from(r).buffer);
    this.dispatchEvent(e);
  }
}

test("la cola envía una petición a la vez y en orden FIFO", async () => {
  const dev = new FakeDevice();
  const t = new HidTransport(dev, { timeout: 50 });
  const order = [];
  await Promise.all([0x03, 0x30, 0x0e].map((c) => {
    const f = Array(65).fill(0); f[1] = 0x55; f[2] = c;
    return t.request(f).then((r) => order.push(r[1]));
  }));
  assert.deepEqual(order, [0x03, 0x30, 0x0e]);
  assert.deepEqual(dev.sent.map((s) => s[2]), [0x03, 0x30, 0x0e]);
  assert.equal(dev.sent[0].length, 65); // Report ID + 64 bytes
});

test("timeout con reintento y luego error", async () => {
  const dev = new FakeDevice({ respond: () => [] });
  const t = new HidTransport(dev, { timeout: 20, retries: 1 });
  await assert.rejects(t.request(cmd.version()), TimeoutError);
  assert.equal(dev.sent.length, 2);
});

test("reintenta y acepta la respuesta del segundo envío", async () => {
  let n = 0;
  const dev = new FakeDevice({ respond: (p) => (n++ === 0 ? [] : [reply(p[1])]) });
  const t = new HidTransport(dev, { timeout: 20, retries: 1 });
  const r = await t.request(cmd.version());
  assert.equal(r[1], 0x03);
  assert.equal(dev.sent.length, 2);
});

test("ignora respuestas de otro comando, con checksum malo y emite las aa fa", async () => {
  const bad = reply(0x0e, [1, 2, 3]); bad[3] ^= 0xff;
  const unsolicited = Array(64).fill(0); unsolicited.splice(0, 11, 0xaa, 0xfa, 0xa5, 0x6a, 0x38, 0, 0, 5, 0xd0, 0x5d, 0);
  const dev = new FakeDevice({ respond: (p) => [reply(0x30), unsolicited, bad, reply(p[1], [7, 8, 9])] });
  const t = new HidTransport(dev, { timeout: 50 });
  const events = [];
  t.on("unsolicited", (e) => events.push(e));
  const r = await t.request(cmd.readConfig(), { validate: true });
  assert.deepEqual(r.slice(8, 11), [7, 8, 9]);
  assert.deepEqual(events, [{ type: "battery", level: 0x5d, charging: false }]);
});

test("close rechaza lo pendiente", async () => {
  const dev = new FakeDevice({ respond: () => [] });
  const t = new HidTransport(dev, { timeout: 1000 });
  const p1 = t.request(cmd.version());
  const p2 = t.request(cmd.battery());
  await new Promise((r) => setTimeout(r, 5));
  await t.close();
  await assert.rejects(p1, /desconectado/);
  await assert.rejects(p2, /desconectado/);
});

test("Mouse decodifica versión, batería y configuración", async () => {
  const version = Array(56).fill(0); version.splice(15, 3, 0x32, 0x32, 0x30);
  const config = [0, 0, 4, 6, 4, 0x90, 1, 0x20, 3, 0xb0, 4, 0x40, 6, 0x60, 9, 0x80, 0x0c, ...Array(23).fill(0), 0, 0xff, 1, 0x0a, 0x0a, 0xff, 0x64];
  const dev = new FakeDevice({
    respond: (p) => {
      if (p[1] === 0x03) return [reply(0x03, version)];
      if (p[1] === 0x30) return [reply(0x30, [94, 0], { len: 10 })];
      if (p[1] === 0x0e) return [reply(0x0e, config.slice(0, 47), { extra: { 55: 1 } })];
      if (p[1] === 0x08) return [reply(0x08, Array(32).fill(0xff))];
      return [];
    },
  });
  const m = new Mouse(new HidTransport(dev, { timeout: 50 }));
  assert.equal(await m.version(), "2.2.0");
  assert.deepEqual(await m.battery(), { level: 94, charging: false });
  const c = await m.readConfig();
  assert.equal(c.dpi_index, 3);
  assert.equal(c.report_rate, 3);
  assert.equal(c.sleep_light, 10);
  assert.equal(c.wakeup_flag, 1);
  const btns = await m.readButtons();
  assert.deepEqual(btns.map((b) => b.bytes), FACTORY_BUTTONS);
});

test("batería por el dongle: acepta r[3] = 0x0b aunque no sea checksum (captures/10)", async () => {
  const real = Array(64).fill(0);
  real.splice(0, 10, 0xaa, 0x30, 0xa5, 0x0b, 0x0a, 1, 1, 0, 0x5e, 0);
  const dev = new FakeDevice({ vendorId: 43173, respond: () => [real] });
  const m = new Mouse(new HidTransport(dev, { timeout: 30, retries: 0 }), { mode: "2.4G" });
  assert.deepEqual(await m.battery(), { level: 94, charging: false });
});

test("Mouse no envía configuraciones inválidas", async () => {
  const dev = new FakeDevice();
  const m = new Mouse(new HidTransport(dev, { timeout: 50 }));
  await assert.rejects(m.writeConfig({ dpi: [1], dpi_count: 9 }), RangeError);
  await assert.rejects(m.setLightMode(9), RangeError);
  assert.equal(dev.sent.length, 0);
});

test("Mouse escribe macros en bloques y cierra con 0x10", async () => {
  const dev = new FakeDevice();
  const m = new Mouse(new HidTransport(dev, { timeout: 50 }));
  const ev = { device: "keyboard", code: 4, down: true, delay: 10 };
  await m.writeMacros([Array(20).fill(ev)]);
  assert.deepEqual(dev.sent.map((s) => s[2]), [0x0d, 0x0d, 0x0d, 0x10]); // 64 + 80 bytes = 3 bloques
  await m.factoryReset();
  assert.deepEqual(dev.sent.slice(4).map((s) => s[2]), [0x09, 0x0f, 0x21]);
});

class FakeHid extends EventTarget {
  constructor(devices) { super(); this.devices = devices; }
  async getDevices() { return this.devices; }
  async requestDevice() { return this.devices; }
  plug(d) { this.devices.push(d); const e = new Event("connect"); e.device = d; this.dispatchEvent(e); }
  unplug(d) { this.devices = this.devices.filter((x) => x !== d); const e = new Event("disconnect"); e.device = d; this.dispatchEvent(e); }
}

const tick = () => new Promise((r) => setTimeout(r, 5));

test("DeviceManager elige la interfaz de control, prefiere USB y reconecta", async () => {
  const other = new FakeDevice({ usage: 1 });
  const dongle = new FakeDevice({ vendorId: 43173 });
  const hid = new FakeHid([other, dongle]);
  const mgr = new DeviceManager(hid, { timeout: 50 });
  const states = [];
  mgr.on("change", (s) => states.push(s.status + (s.mode ? `:${s.mode}` : "")));
  await mgr.start();
  assert.equal(mgr.state.device, dongle);
  assert.ok(dongle.opened);

  const usb = new FakeDevice();
  hid.unplug(dongle);
  await tick();
  assert.equal(mgr.state.status, "searching");
  hid.plug(usb);
  await tick();
  assert.equal(mgr.state.device, usb);
  assert.deepEqual(states, ["connected:2.4G", "searching", "connected:USB"]);
});

test("DeviceManager.request avisa cuando no hay mouse (NotFoundError o lista vacía)", async () => {
  const hid = new FakeHid([]);
  const mgr = new DeviceManager(hid, { timeout: 50 });
  await assert.rejects(mgr.request(), /No se encontró el mouse/);
  hid.requestDevice = async () => { throw Object.assign(new Error("Failed to execute"), { name: "NotFoundError" }); };
  await assert.rejects(mgr.request(), /No se encontró el mouse/);
  hid.requestDevice = async () => { throw new Error("otro"); };
  await assert.rejects(mgr.request(), /otro/);
});

test("DeviceManager repite el escaneo si llega un connect mientras abre otro dispositivo", async () => {
  const dongle = new FakeDevice({ vendorId: 43173 });
  const slow = dongle.open.bind(dongle);
  dongle.open = async () => { await tick(); await slow(); };
  const hid = new FakeHid([dongle]);
  const mgr = new DeviceManager(hid, { timeout: 50 });
  const starting = mgr.start();
  await new Promise((r) => setTimeout(r, 1));
  const usb = new FakeDevice();
  hid.plug(usb); // llega mientras el dongle se está abriendo
  await starting;
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(mgr.state.device, usb);
});
