// Abre la app, recorre las pestañas y guarda una captura de cada una. Solo navega por la UI:
// no hace clic en nada que escriba al mouse. Uso: npx electron scripts/screenshot.js <carpeta> [ms] [--demo]
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(process.argv[2] || "out/screens");
const wait = Number(process.argv[3]) || 5000;
const TABS = ["Rendimiento", "Botones", "Macros", "Iluminación", "Ajustes", "Perfiles"];
if (process.argv.includes("--demo")) process.env.AJ_DEMO = "1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(outDir, { recursive: true });
app.on("browser-window-created", (_e, win) => {
  win.webContents.on("console-message", (_ev, level, message) => console.log(`[renderer:${level}] ${message}`));
  win.webContents.once("did-finish-load", async () => {
    await sleep(wait);
    for (const tab of TABS) {
      await win.webContents.executeJavaScript(
        `[...document.querySelectorAll(".nav")].find((b) => b.textContent.includes(${JSON.stringify(tab)}))?.click()`);
      await sleep(400);
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(outDir, `${tab}.png`), img.toPNG());
    }
    console.log(await win.webContents.executeJavaScript("document.querySelector('.topbar')?.innerText"));
    app.quit();
  });
});

await import("../electron/main.js");
