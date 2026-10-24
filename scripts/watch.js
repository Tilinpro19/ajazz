// Lee la config cada 300 ms y avisa cuando cambia un byte. Solo lectura.
// Uso: node scripts/watch.js [segundos]
import HID from "node-hid";
import { VENDOR_IDS, PRODUCT_ID, USAGE_PAGE, USAGE, cmd } from "../src/protocol.js";

const secs = Number(process.argv[2]) || 60;
const info = HID.devices().find((d) => VENDOR_IDS.includes(d.vendorId) && d.productId === PRODUCT_ID &&
  d.usagePage === USAGE_PAGE && d.usage === USAGE);
if (!info) throw new Error("mouse no encontrado");
const dev = new HID.HID(info.path);
let prev = null;
const end = Date.now() + secs * 1000;
try {
  while (Date.now() < end) {
    while (dev.readTimeout(0).length) {}
    dev.write(cmd.readConfig());
    const r = dev.readTimeout(500);
    if (r.length) {
      if (prev) for (let i = 8; i < 56; i++) if (r[i] !== prev[i])
        console.log(`${new Date().toLocaleTimeString()}  r[${i}]  ${prev[i]} -> ${r[i]}`);
      prev = r;
    }
    await new Promise((s) => setTimeout(s, 300));
  }
} finally { dev.close(); }
console.log("fin");
