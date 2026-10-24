// Compara dos volcados de probe.js y muestra los bytes que cambiaron.
// Uso: node scripts/diff.js captures/antes.json captures/despues.json
import fs from "node:fs";

const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
if (!a || !b) {
  console.error("Uso: node scripts/diff.js antes.json despues.json");
  process.exit(1);
}

const bytes = (s) => s.split(" ").map((h) => parseInt(h, 16));
let changes = 0;

for (const name of Object.keys(a)) {
  if (name === "date" || name === "mode" || !b[name]) continue;
  const x = bytes(a[name]);
  const y = bytes(b[name]);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === y[i]) continue;
    changes++;
    console.log(`${name.padEnd(12)} r[${i}]  ${x[i]} -> ${y[i]}  (0x${x[i]?.toString(16)} -> 0x${y[i]?.toString(16)})`);
  }
}

if (!changes) console.log("Sin cambios.");
