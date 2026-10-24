// Prueba de interacción de la UI sobre el mouse simulado (#demo). No toca el hardware.
// Uso: npm run test:ui (deja capturas en out/e2e).
import { app } from "electron";
import fs from "node:fs";
process.env.AJ_DEMO = "1";
const shotDir = process.argv[2] || "out/e2e";
fs.mkdirSync(shotDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.on("browser-window-created", (_e, win) => {
  const errors = [];
  win.webContents.on("console-message", (_ev, level, msg) => { if (level >= 2) errors.push(msg); });
  win.webContents.once("did-finish-load", async () => {
    const js = (code) => win.webContents.executeJavaScript(code);
    const shot = async (n) => fs.writeFileSync(`${shotDir}/${n}.png`, (await win.webContents.capturePage()).toPNG());
    const nav = (t) => js(`[...document.querySelectorAll(".nav")].find(b => b.textContent.includes(${JSON.stringify(t)})).click()`);
    const clickText = (sel, t) => js(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(b => b.textContent.includes(${JSON.stringify(t)})); if (!el) return "NO " + ${JSON.stringify(t)}; el.click(); return "ok"; })()`);
    const results = {};
    try {
      await sleep(2000);
      results.lvl = await clickText(".dpi-select", "Nivel 4"); await sleep(400);
      results.active = await js(`document.querySelector(".dpi-level.active .dpi-select").textContent`);
      // Cambiar DPI del nivel 1 escribiendo en el input
      await js(`(() => { const i = document.querySelector(".dpi-level .number"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; i.focus(); set.call(i, "1234"); i.dispatchEvent(new Event("input", {bubbles:true})); i.blur(); })()`);
      await sleep(400);
      results.dpi1 = await js(`document.querySelector(".dpi-level .number").value`);
      await nav("Iluminación"); await sleep(300);
      results.light = await clickText(".light-card", "Respiración"); await sleep(400);
      results.lightActive = await js(`document.querySelector(".light-card.active .light-name").textContent`);
      await shot("luz");
      await nav("Macros"); await sleep(300);
      await clickText(".btn", "Nueva macro"); await sleep(200);
      await clickText(".modal .btn", "Crear"); await sleep(300);
      await clickText(".btn", "Grabar"); await sleep(300);
      await js(`(() => { const a = document.querySelector(".record-area"); for (const [t, c] of [["keydown","KeyA"],["keyup","KeyA"],["keydown","KeyB"],["keyup","KeyB"]]) a.dispatchEvent(new KeyboardEvent(t, {code: c, key: c.slice(3), bubbles: true})); a.dispatchEvent(new MouseEvent("mousedown", {button: 0, bubbles: true})); a.dispatchEvent(new MouseEvent("mouseup", {button: 0, bubbles: true})); })()`);
      await sleep(300);
      await clickText(".btn", "Terminar"); await sleep(300);
      results.events = await js(`document.querySelectorAll(".events tbody tr").length`);
      results.bytes = await js(`document.querySelector(".usage").textContent`);
      await clickText(".btn", "Guardar en el mouse"); await sleep(800);
      results.macroBtn = await js(`[...document.querySelectorAll(".section-actions .btn")].map(b => b.textContent).join("|")`);
      await shot("macros");
      await nav("Botones"); await sleep(300);
      await clickText(".button-item", "Adelante"); await sleep(200);
      await clickText(".segmented button", "Macro"); await sleep(200);
      results.assign = await clickText(".editor .btn", "Asignar"); await sleep(600);
      await clickText(".button-item", "Atrás"); await sleep(200);
      await clickText(".segmented button", "Multimedia"); await sleep(200);
      await clickText(".choice", "Volumen +"); await sleep(600);
      results.buttons = await js(`[...document.querySelectorAll(".button-text small")].map(s => s.textContent).join(" | ")`);
      await shot("botones");
      await nav("Perfiles"); await sleep(300);
      await clickText(".btn", "Nuevo perfil"); await sleep(200);
      await clickText(".modal .btn", "Crear"); await sleep(300);
      await nav("Iluminación"); await sleep(200);
      await clickText(".light-card", "Apagado"); await sleep(400);
      await nav("Perfiles"); await sleep(300);
      results.use = await clickText(".profile .btn", "Usar"); await sleep(1000);
      results.profiles = await js(`[...document.querySelectorAll(".profile")].map(p => p.innerText.split(String.fromCharCode(10)).join(" ")).join(" || ")`);
      await nav("Iluminación"); await sleep(300);
      results.lightAfterSwitch = await js(`document.querySelector(".light-card.active .light-name").textContent`);
      results.toasts = await js(`[...document.querySelectorAll(".toast")].map(t => t.className + ": " + t.textContent).join(" || ")`);
      await shot("perfiles");
    } catch (err) { results.exception = String(err); }
    const expected = {
      active: "Nivel 4Activo", dpi1: "1250", lightActive: "Respiración", events: 6, macroBtn: "Sin cambios pendientes",
      buttons: "Clic izquierdo | Clic derecho | Clic central | Volumen + | Macro: Macro 1 | Ciclo de DPI | Rueda arriba | Rueda abajo",
      lightAfterSwitch: "Respiración",
    };
    const failed = Object.entries(expected).filter(([k, v]) => results[k] !== v);
    if (results.exception) failed.push(["exception", results.exception]);
    if (errors.length) failed.push(["consola", errors.join(" | ")]);
    if (/toast (error|warn)/.test(results.toasts || "")) failed.push(["toasts", results.toasts]);
    for (const [k] of failed) console.log(`FALLA ${k}: ${JSON.stringify(results[k] ?? errors)}`);
    console.log(failed.length ? `${failed.length} fallas` : "UI OK: todas las comprobaciones pasaron");
    app.exit(failed.length ? 1 : 0);
  });
});
await import("../electron/main.js");
