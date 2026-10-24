// Lee los 4096 bytes de macros (solo lectura). Uso: node scripts/macros.js [--save captures/x.json]
import fs from "node:fs";
import HID from "node-hid";
import { VENDOR_IDS, PRODUCT_ID, USAGE_PAGE, USAGE, cmd, macroReadRequests } from "../src/protocol.js";

const info = HID.devices().find((d) => VENDOR_IDS.includes(d.vendorId) && d.productId === PRODUCT_ID &&
  d.usagePage === USAGE_PAGE && d.usage === USAGE);
if (!info) throw new Error("mouse no encontrado");
const dev = new HID.HID(info.path);
const out = [];
try {
  for (const req of macroReadRequests()) {
    const frame = Array(65).fill(0);
    // macroRead trae [reportId, cmd, n, lo, hi]; en Windows el frame lleva Report ID 0 al inicio.
    req.forEach((b, i) => (frame[i + 1] = b));
    while (dev.readTimeout(0).length) {}
    dev.write(frame);
    const r = dev.readTimeout(1000);
    if (!r.length) throw new Error(`sin respuesta en offset ${req[3] | (req[4] << 8)}`);
    if (out.length === 0) console.log("primera respuesta:", Buffer.from(r).toString("hex"));
    out.push(...r.slice(8, 8 + r[4]));
  }
} finally { dev.close(); }
const buf = Buffer.from(out);
console.log("bytes leídos:", buf.length);
let last = buf.length; while (last > 0 && (buf[last - 1] === 0xff || buf[last - 1] === 0)) last--;
console.log("último byte útil en:", last);
for (let i = 0; i < Math.min(last + 16, buf.length); i += 16)
  console.log(i.toString(16).padStart(4, "0"), [...buf.slice(i, i + 16)].map((b) => b.toString(16).padStart(2, "0")).join(" "));
const s = process.argv.indexOf("--save");
if (s > 0) { fs.writeFileSync(process.argv[s + 1], buf.toString("hex") + "\n"); console.log("guardado"); }
