// Fase 0: lee el estado del mouse y lo imprime. Solo envía comandos de lectura.
// Uso: node scripts/probe.js [--raw] [--save captures/nombre.json]
// Con --save guarda las respuestas crudas, para respaldo y para comparar con diff.
import fs from "node:fs";
import path from "node:path";
import HID from "node-hid";
import {
  VENDOR_IDS, PRODUCT_ID, USAGE_PAGE, USAGE,
  cmd, decodeConfig, decodeButtons,
} from "../src/protocol.js";

const RAW = process.argv.includes("--raw");
const saveIdx = process.argv.indexOf("--save");
const SAVE = saveIdx > 0 ? process.argv[saveIdx + 1] : null;
const TIMEOUT_MS = 1000;
const dump = {};

function findDevice() {
  const info = HID.devices().find((d) =>
    VENDOR_IDS.includes(d.vendorId) && d.productId === PRODUCT_ID &&
    d.usagePage === USAGE_PAGE && d.usage === USAGE);
  if (!info) throw new Error("No se encontró el AJ139 V2 MC (interfaz vendor 0xFF00/16)");
  return info;
}

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(" ");

// Envía el frame de 65 bytes (Report ID en [0]) y espera la siguiente respuesta.
function request(dev, name, frame) {
  // Descarta respuestas pendientes de peticiones anteriores.
  while (dev.readTimeout(0).length) {}
  dev.write(frame);
  const resp = dev.readTimeout(TIMEOUT_MS);
  if (RAW) {
    console.log(`> ${name}: ${hex(frame.slice(0, 12))} ...`);
    console.log(`< ${name} (${resp.length}): ${hex(resp)}`);
  }
  if (!resp.length) throw new Error(`${name}: sin respuesta en ${TIMEOUT_MS} ms`);
  dump[name] = hex(resp);
  return resp;
}

const info = findDevice();
const mode = info.vendorId === 43172 ? "USB" : "2.4G";
console.log(`Dispositivo: ${info.product} (${mode})`);
const dev = new HID.HID(info.path);

try {
  const v = request(dev, "version", cmd.version());
  console.log("Firmware:", String.fromCharCode(v[23], 46, v[24], 46, v[25]));

  const b = request(dev, "battery", cmd.battery());
  console.log(`Batería: ${b[8]}%  carga: ${b[9]}`);

  const o = request(dev, "online", cmd.online());
  console.log("En línea:", o[8] === 2, `(t[8]=${o[8]})`);

  const c = request(dev, "readConfig", cmd.readConfig());
  console.log("Configuración:", decodeConfig(c));

  const btn = request(dev, "readButtons", cmd.readButtons());
  console.log("Botones:");
  decodeButtons(btn).forEach((e, i) => console.log(`  ${i + 1}:`, e));
} finally {
  dev.close();
}

if (SAVE) {
  fs.mkdirSync(path.dirname(SAVE), { recursive: true });
  fs.writeFileSync(SAVE, JSON.stringify({ date: new Date().toISOString(), mode, ...dump }, null, 2) + "\n");
  console.log("Guardado en", SAVE);
}
