// Pruebas de T1: tramas reales de captures/12 y 13 (copiadas aquí porque captures/ no se sube a git)
// y valores de fábrica de docs/PROTOCOL.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cmd, button, decodeButtons, decodeAction, encodeAction, FACTORY_BUTTONS, FACTORY_CONFIG,
  factoryResetFrames, encodeMacros, decodeMacros, macroWriteFrames, decodeUnsolicited,
  decodeConfig, decodeVersion, decodeBattery, decodeOnline, validateConfig,
} from "../src/protocol.js";

const real = (s) => s.trim().split(/\s+/).map((h) => parseInt(h, 16));
// La web envía 64 bytes sin Report ID; nuestros frames llevan el Report ID 0 en [0].
const payload = (frame) => [...frame.slice(1), ...Array(65 - frame.length).fill(0)];
const zeros = (n) => " 00".repeat(n);

// captures/12-web-sendreport.txt (wakeup_flag 0 y luego 1, report rate 250 Hz)
const CAP12_CONFIG = "55 0f ae 0a 2f 01 01 00 00 01 02 06 05 90 01 20 03 b0 04 40 06 60 09 80 0c" + zeros(24) +
  " ff 01 0a 05 ff 00 00" + zeros(8);
const CAP12_BUTTONS = "55 09 a5 22 31 00 00 00 20 01 00 00 20 02 00 00 20 04 00 00 20 00 00 00 20 10 00 00 21 55 00 00" +
  " 21 38 01 00 21 38 ff 00" + zeros(24);
const CAP12_MACRO1 = "55 0d 00 00 38 00 00 00 40" + zeros(55);
const CAP12_MACRO2 = "55 0d 00 00 18 38 00 00" + zeros(8) + " 0a 00 43 01 0a 00 03 01 0a 00 42 04 0a 00 82 04" + zeros(32);
const CAP12_CONFIRM = "55 10 a5 22 00 00 00 05" + zeros(56);

const cap12Config = {
  light_mode: 1, report_rate: 1, dpi_count: 6, dpi_index: 4, dpi: [400, 800, 1200, 1600, 2400, 3200],
  scroll_flag: 0, lod_value: 0xff, sensor_flag: 1, key_respond: 0x0a, sleep_light: 5, highspeed_mode: 0xff, wakeup_flag: 0,
};

test("writeConfig reproduce byte a byte las dos tramas de la captura 12", () => {
  assert.equal(real(CAP12_CONFIG).length, 64);
  assert.deepEqual(payload(cmd.writeConfig(cap12Config)), real(CAP12_CONFIG));
  const withWake = real(CAP12_CONFIG); withWake[54] = 1;
  assert.deepEqual(payload(cmd.writeConfig({ ...cap12Config, wakeup_flag: 1 })), withWake);
});

test("writeButtons con Backward deshabilitado reproduce la captura 12", () => {
  const entries = [...FACTORY_BUTTONS]; entries[3] = button.mouse(0);
  assert.deepEqual(payload(cmd.writeButtons(entries)), real(CAP12_BUTTONS));
});

test("macro de 4 eventos y confirmación reproducen la captura 12", () => {
  const ev = (device, code, down) => ({ device, code, down, delay: 10 });
  const data = encodeMacros([[ev("mouse", 1, true), ev("mouse", 1, false), ev("keyboard", 4, true), ev("keyboard", 4, false)]]);
  const frames = macroWriteFrames(data).map(payload);
  assert.equal(frames.length, 3);
  assert.deepEqual(frames[0], real(CAP12_MACRO1));
  assert.deepEqual(frames[1], real(CAP12_MACRO2));
  assert.deepEqual(frames[2], real(CAP12_CONFIRM));
  assert.deepEqual(payload(cmd.confirm()), real(CAP12_CONFIRM));
});

test("asignaciones de la captura 13 (entrada 4)", () => {
  assert.deepEqual(button.keyboard(4, 9), real("10 04 09 00")); // Alt+F
  assert.deepEqual(button.macro(0, 1, 0), real("70 00 01 00"));
  assert.deepEqual(button.macro(0, 1, 2), real("70 00 01 02"));
  assert.deepEqual(button.macro(0, 1, 3), real("70 00 01 03"));
});

test("reset de fábrica: botones con longitud 0x20, config y luz 0", () => {
  const [b, c, l] = factoryResetFrames().map(payload);
  assert.deepEqual(b, real("55 09 a5 22 20 00 00 00 20 01 00 00 20 02 00 00 20 04 00 00 20 08 00 00 20 10 00 00" +
    " 21 55 00 00 21 38 01 00 21 38 ff 00" + zeros(24)));
  assert.deepEqual(c.slice(0, 25), real("55 0f ae 0a 2f 01 01 00 00 00 04 05 02 90 01 20 03 b0 04 40 06 60 09 80 0c"));
  assert.deepEqual(c.slice(48, 55), [0, 1, 0x35, 4, 10, 0, 0]);
  assert.deepEqual(l.slice(0, 12), real("55 21 00 00 03 00 00 00 00 00 00 00"));
  assert.deepEqual(validateConfig(FACTORY_CONFIG), []);
});

test("botones en FF FF FF FF se leen como tabla de fábrica", () => {
  const resp = real("aa 08 a5 00 20 00 00 00" + " ff".repeat(32) + zeros(24));
  const btns = decodeButtons(resp);
  assert.ok(btns.every((b) => b.factory));
  assert.deepEqual(btns.map((b) => b.bytes), FACTORY_BUTTONS);
  assert.deepEqual(btns.map((b) => b.action.kind), ["mouse", "mouse", "mouse", "mouse", "mouse", "dpi", "wheel", "wheel"]);
});

test("decodeAction y encodeAction son inversas", () => {
  const samples = [
    button.mouse(8), button.mouse(0), button.wheel(1), button.wheel(-1), button.dpiLoop(),
    button.keyboard(4, 9), button.keyboard(0, 41), button.media(0xe9), button.media(0x192), button.macro(3, 5, 0),
    [0x99, 1, 2, 3],
  ];
  for (const s of samples) assert.deepEqual(encodeAction(decodeAction(s)), s);
  assert.deepEqual(decodeAction([0xf0, 1, 1, 0]), { kind: "dpi" }); // codificación alternativa del botón DPI
  assert.deepEqual(decodeAction([0x30, 0x92, 0x01, 0]), { kind: "media", usage: 0x192 }); // calculadora
});

test("varias macros: tabla de direcciones y decodificación de ida y vuelta", () => {
  const a = [{ device: "keyboard", code: 4, down: true, delay: 10 }, { device: "keyboard", code: 4, down: false, delay: 300 }];
  const b = [{ device: "mouse", code: 2, down: true, delay: 0 }, { device: "mouse", code: 2, down: false, delay: 1000 }];
  const data = encodeMacros([a, [], b]);
  assert.deepEqual(data.slice(0, 6), [0x40, 0, 0, 0, 0x48, 0]);
  assert.deepEqual(data.slice(0x48, 0x50), [0, 0, 0x43, 2, 0xe8, 0x03, 0x83, 2]);
  assert.deepEqual(decodeMacros(data), [a, [], b]);
  assert.throws(() => encodeMacros(Array(33).fill(a)));
});

test("mensajes no solicitados aa fa", () => {
  assert.deepEqual(decodeUnsolicited(real("aa fa a5 6a 38 00 00 05 d0 5d" + zeros(54))),
    { type: "battery", level: 0x5d, charging: false });
  assert.deepEqual(decodeUnsolicited(real("aa fa ae 23 0a 01 01 01 10 02 04" + zeros(53))),
    { type: "status", dpi_index: 1, report_rate: 3 });
  assert.equal(decodeUnsolicited(real("aa 0e" + zeros(62))), null);
});

test("respuestas de versión, batería y online (captures/factory.json)", () => {
  const version = real("aa 03 00 2c 38 00 00 00 59 4a 58 2e 63 6f 2e 6d 6f 75 73 65 aa 02 03 32 32 30" + zeros(38));
  assert.equal(decodeVersion(version), "2.2.0");
  assert.deepEqual(decodeBattery(real("aa 30 a5 71 0a 01 01 00 64 01" + zeros(54))), { level: 100, charging: true });
  assert.equal(decodeOnline(real("aa ed 00 2e 2e 00 00 00 00" + zeros(55))), false);
  assert.equal(decodeOnline(real("aa ed 00 2e 2e 00 00 00 02" + zeros(55))), true);
});

test("validateConfig rechaza light_mode, report_rate y bytes fuera de rango", () => {
  const c = decodeConfig(real("aa 0e a5 59 2f 01 01 00 00 00 04 06 04 90 01 20 03 b0 04 40 06 60 09 80 0c" + zeros(23) +
    " 00 ff 01 0a 0a ff 64 00" + zeros(8)));
  assert.deepEqual(validateConfig(c), []);
  assert.ok(validateConfig({ ...c, light_mode: 7 }).length);
  assert.ok(validateConfig({ ...c, report_rate: 4 }).length);
  assert.ok(validateConfig({ ...c, sleep_light: 300 }).length);
  assert.throws(() => cmd.writeButtons([...FACTORY_BUTTONS.slice(0, 7), [0x20, 256, 0, 0]]));
});
