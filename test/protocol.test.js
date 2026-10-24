import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cmd,
  decodeConfig,
  decodeButtons,
  validateConfig,
  macroWriteFrames,
  macroReadRequests,
  splitFrame,
  isValidResponse,
  DEFAULT_CONFIG,
} from "../src/protocol.js";

// Respuesta real de readConfig (USB, firmware 2.2.0), ver captures/01-dpi2400.json.
const REAL_CONFIG = ("aa 0e a5 5a 2f 01 01 00 00 00 04 06 05 90 01 20 03 b0 04 40 06 60 09 80 0c " +
  "00 ".repeat(24) + "ff 01 0a 0a ff 64 00 00 00 00 00 00 00 00 00")
  .trim().split(" ").map((h) => parseInt(h, 16));

test("respuesta real: checksum y decodificación", () => {
  assert.equal(REAL_CONFIG.length, 64);
  assert.ok(isValidResponse(REAL_CONFIG, 0x0e));
  assert.ok(!isValidResponse([...REAL_CONFIG.slice(0, 12), 6, ...REAL_CONFIG.slice(13)], 0x0e));
  // r[55] queda fuera de los 47 bytes de datos: no entra en el checksum.
  assert.ok(isValidResponse([...REAL_CONFIG.slice(0, 55), 1, ...REAL_CONFIG.slice(56)], 0x0e));
  const c = decodeConfig(REAL_CONFIG);
  assert.equal(c.dpi_index, 4);
  assert.equal(c.dpi_count, 6);
  assert.deepEqual(c.dpi, [400, 800, 1200, 1600, 2400, 3200]);
});

// La respuesta del mouse no trae el Report ID: se simula desplazando el frame -1.
const asResponse = (frame) => [...frame.slice(1), 0];

const sample = {
  light_mode: 1,
  report_rate: 2,
  dpi_count: 4,
  dpi_index: 2,
  dpi: [400, 800, 1200, 1600, 2400, 3200],
  scroll_flag: 0,
  lod_value: 1,
  sensor_flag: 53,
  key_respond: 4,
  sleep_light: 10,
  highspeed_mode: 0,
  wakeup_flag: 0,
};

test("writeConfig coloca los campos en los índices del bundle", () => {
  const f = cmd.writeConfig(sample);
  assert.equal(f.length, 65);
  assert.deepEqual(f.slice(0, 8), [0, 0x55, 0x0f, 0xae, 0x0a, 0x2f, 1, 1]);
  assert.equal(f[10], 1); // light_mode
  assert.equal(f[11], 3); // report_rate + 1
  assert.equal(f[12], 4); // dpi_count
  assert.equal(f[13], 3); // dpi_index + 1
  assert.equal(f[14], 400 & 0xff); // dpi1 lo
  assert.equal(f[15], 400 >> 8); // dpi1 hi
  assert.equal(f[55], 0); // wakeup_flag
});

test("decodeConfig invierte writeConfig cuando la respuesta viene desplazada", () => {
  const back = decodeConfig(asResponse(cmd.writeConfig(sample)));
  assert.equal(back.light_mode, sample.light_mode);
  assert.equal(back.report_rate, sample.report_rate);
  assert.equal(back.dpi_index, sample.dpi_index);
  assert.deepEqual(back.dpi, sample.dpi);
  assert.equal(back.lod_value, sample.lod_value);
  assert.equal(back.sensor_flag, sample.sensor_flag);
});

test("respuesta en 0x00 o 0xFF usa valores de fábrica", () => {
  const zeros = Array(64).fill(0);
  assert.deepEqual(decodeConfig(zeros), DEFAULT_CONFIG);
  const ones = Array(64).fill(255);
  assert.deepEqual(decodeConfig(ones).dpi, DEFAULT_CONFIG.dpi);
});

test("decodeButtons lee 8 entradas de 4 bytes desde el índice 8", () => {
  const resp = Array(64).fill(0);
  resp.splice(8, 4, 32, 1, 0, 0); // click izquierdo
  resp.splice(12, 4, 33, 56, 1, 0); // rueda arriba
  const btns = decodeButtons(resp);
  assert.equal(btns.length, 8);
  assert.deepEqual(btns[0], { type: 32, code1: 1, code2: 0, code3: 0 });
  assert.deepEqual(btns[1], { type: 33, code1: 56, code2: 1, code3: 0 });
});

test("validateConfig rechaza valores fuera de rango", () => {
  assert.deepEqual(validateConfig(sample), []);
  assert.ok(validateConfig({ ...sample, dpi_index: 9 }).length > 0);
  assert.ok(validateConfig({ ...sample, dpi: [10, 800, 1200, 1600, 2400, 3200] }).length > 0);
});

test("macroReadRequests cubre los 4096 bytes en bloques de 56", () => {
  const reqs = macroReadRequests();
  const total = reqs.reduce((s, r) => s + r[2], 0);
  assert.equal(total, 4096);
  assert.deepEqual(reqs[0], [6, 12, 56, 0, 0]);
  assert.deepEqual(reqs[1], [6, 12, 56, 56, 0]);
});

test("macroWriteFrames agrega la confirmación final", () => {
  const data = Array.from({ length: 100 }, (_, i) => i);
  const frames = macroWriteFrames(data);
  assert.equal(frames.length, 3); // 56 + 44 + confirmación
  assert.deepEqual(frames[1].slice(0, 9), [0, 0x55, 0x0d, 0, 0, 44, 56, 0, 0]);
  assert.deepEqual(frames[2], [0, 0x55, 0x10, 0xa5, 0x22, 0, 0, 0, 5]);
});

test("splitFrame separa Report ID y payload de 64 bytes", () => {
  const { reportId, payload } = splitFrame(cmd.version());
  assert.equal(reportId, 0);
  assert.equal(payload.length, 64);
  assert.equal(payload[0], 0x55);
});

// Tramas reales capturadas de la web (captures/12-web-sendreport.txt y 13).
const real = (s) => s.trim().split(/\s+/).map((h) => parseInt(h, 16));

test("writeButtons con Alt+F y macro reproducen las tramas reales de la web", async () => {
  const { cmd, button } = await import("../src/protocol.js");
  const base = [button.mouse(1), button.mouse(2), button.mouse(4), button.mouse(0), button.mouse(0x10),
    [0x21, 0x55, 0, 0], [0x21, 0x38, 1, 0], [0x21, 0x38, 0xff, 0]];
  const altF = [...base]; altF[3] = button.keyboard(4, 9);
  assert.deepEqual(cmd.writeButtons(altF).slice(1, 33), real("55 09 a5 22 31 00 00 00 20 01 00 00 20 02 00 00 20 04 00 00 10 04 09 00 20 10 00 00 21 55 00 00"));
  const macro = [...base]; macro[3] = button.macro(0, 1, 2);
  assert.deepEqual(cmd.writeButtons(macro).slice(9, 25), real("20 01 00 00 20 02 00 00 20 04 00 00 70 00 01 02"));
});

test("encodeMacro y macroWriteFrames reproducen las tramas reales de Super Macro", async () => {
  const { encodeMacro, macroWriteFrames } = await import("../src/protocol.js");
  const ev = (device, code, down) => ({ device, code, down, delay: 10 });
  const data = encodeMacro([ev("mouse", 1, true), ev("mouse", 1, false), ev("keyboard", 4, true), ev("keyboard", 4, false),
    ev("keyboard", 4, true), ev("keyboard", 4, false), ev("mouse", 1, true), ev("mouse", 1, false)]);
  const frames = macroWriteFrames(data);
  assert.deepEqual(frames[1].slice(1, 9), real("55 0d 00 00 28 38 00 00"));
  assert.deepEqual(frames[1].slice(9, 9 + 40),
    real("00 00 00 00 00 00 00 00 0a 00 43 01 0a 00 03 01 0a 00 42 04 0a 00 02 04 0a 00 42 04 0a 00 02 04 0a 00 43 01 0a 00 83 01"));
});
