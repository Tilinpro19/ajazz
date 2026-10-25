// Estado de la app: conexión, datos leídos del mouse, perfiles y acciones de la UI.
// Regla: el mouse es la fuente de verdad al conectar (no se escribe nada al arrancar);
// cada cambio se valida, se aplica de forma optimista y se revierte si el mouse no responde.
import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceManager } from "../device/hid.js";
import { Mouse, SUPPORTED_FIRMWARE } from "../device/mouse.js";
import { DemoHid } from "../device/demo.js";
import { validateConfig } from "../protocol.js";
import {
  migrate, activeProfile, updateProfile, addProfile, removeProfile, newProfile, exportProfile,
  importProfile, profileForExecutable, removeMacro as removeMacroFromStore, newMacro, factoryButtons,
} from "../profiles.js";
import { api } from "./api.js";

// #demo: mouse simulado; no se tocan los perfiles ni los respaldos reales.
const DEMO = location.hash === "#demo";
const BATTERY_POLL_MS = 60_000;
const ONLINE_POLL_MS = 3_000;
const clone = (v) => JSON.parse(JSON.stringify(v));

export function useController() {
  const [conn, setConn] = useState({ status: "searching" });
  const [info, setInfo] = useState(null); // { firmware, battery, online, mode, name }
  const [config, setConfig] = useState(null);
  const [buttons, setButtons] = useState(null); // 8 acciones (decodeAction)
  const [store, setStoreState] = useState(null);
  const [macrosDirty, setMacrosDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [backup, setBackup] = useState(null);
  const [foreground, setForeground] = useState(null);

  const mouseRef = useRef(null);
  const managerRef = useRef(null);
  const live = useRef({});
  live.current = { config, buttons, store, info, macrosDirty, busy };
  const switching = useRef(false); // mientras se aplica un perfil, el mouse aún tiene el anterior
  const switchQueue = useRef(Promise.resolve());
  const chain = useRef(Promise.resolve());

  const toast = useCallback((text, kind = "info") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3500);
  }, []);

  const setStore = useCallback((next) => {
    setStoreState((prev) => (typeof next === "function" ? next(prev) : next));
  }, []);

  // Operaciones del mouse en serie (una escritura compuesta no se mezcla con otra).
  const run = useCallback((label, fn) => {
    const job = chain.current.then(async () => {
      const mouse = mouseRef.current;
      if (!mouse) throw new Error("el mouse no está conectado");
      setBusy(true);
      try {
        return await fn(mouse);
      } finally {
        setBusy(false);
      }
    });
    chain.current = job.catch(() => {});
    return job.catch((err) => {
      toast(`${label}: ${err.message}`, "error");
      throw err;
    });
  }, [toast]);

  // ---- Perfiles: carga y guardado en disco ----

  useEffect(() => {
    (DEMO ? Promise.resolve(null) : api.loadStore())
      .then((raw) => setStoreState(migrate(raw)))
      .catch((err) => {
        toast(`No se pudieron leer los perfiles: ${err.message}`, "error");
        setStoreState(migrate(null));
      });
  }, [toast]);

  useEffect(() => {
    if (!store || DEMO) return;
    const t = setTimeout(() => api.saveStore(store).catch((err) => toast(`No se guardaron los perfiles: ${err.message}`, "error")), 300);
    return () => clearTimeout(t);
  }, [store, toast]);

  // Guarda en el perfil activo lo que hay ahora en el mouse.
  const syncActive = useCallback((patch) => {
    if (switching.current) return;
    setStore((s) => (s ? updateProfile(s, s.activeProfileId, patch) : s));
  }, [setStore]);

  // ---- Conexión ----

  const loadFromMouse = useCallback(async (mouse) => {
    const online = await mouse.online();
    if (!online) {
      setInfo((i) => ({ ...i, online: false }));
      return false;
    }
    const firmware = await mouse.version();
    const battery = await mouse.battery();
    const cfg = await mouse.readConfig();
    const btns = await mouse.readButtons();
    const validBattery = (battery && Number.isFinite(battery.level) && battery.level >= 1 && battery.level <= 100)
      ? battery
      : (live.current.info?.battery || null);
    setInfo((i) => ({ ...i, firmware, battery: validBattery, online: true }));
    setConfig(cfg);
    setButtons(btns.map((b) => b.action));
    syncActive({ config: cfg, buttons: btns.map((b) => b.action) });
    if (!DEMO) api.ensureBackup({ date: new Date().toISOString(), mode: mouse.mode, firmware, config: cfg, buttons: btns.map((b) => b.bytes) })
      .then(setBackup)
      .catch(() => {});
    if (firmware !== SUPPORTED_FIRMWARE) toast(`Firmware ${firmware}: la app se probó con ${SUPPORTED_FIRMWARE}. Algunas opciones podrían no funcionar.`, "warn");
    return true;
  }, [syncActive, toast]);

  useEffect(() => {
    const hid = DEMO ? new DemoHid() : navigator.hid;
    if (!hid) {
      setConn({ status: "error", error: new Error("WebHID no está disponible en este entorno") });
      return;
    }
    const mgr = new DeviceManager(hid);
    managerRef.current = mgr;
    let offUnsolicited = null;
    const off = mgr.on("change", async (state) => {
      offUnsolicited?.();
      setConn({ status: state.status, mode: state.mode, error: state.error });
      if (state.status !== "connected") {
        mouseRef.current = null;
        setInfo(null);
        setConfig(null);
        setButtons(null);
        return;
      }
      const mouse = new Mouse(state.transport, { mode: state.mode });
      mouseRef.current = mouse;
      setInfo({ mode: state.mode, name: DEMO ? "AJ139 V2 MC (demo)" : "AJ139 V2 MC", online: null });
      offUnsolicited = state.transport.on("unsolicited", (ev) => {
        if (ev.type === "battery") {
          const lvl = Number(ev.level);
          if (Number.isFinite(lvl) && lvl >= 1 && lvl <= 100) {
            setInfo((i) => i && { ...i, battery: { level: lvl, charging: Boolean(ev.charging) } });
          }
        }
        if (ev.type === "status") {
          setConfig((c) => {
            if (!c) return c;
            const next = { ...c, dpi_index: ev.dpi_index, report_rate: ev.report_rate };
            if (validateConfig(next).length) return c;
            syncActive({ config: next });
            return next;
          });
        }
      });
      try {
        await loadFromMouse(mouse);
      } catch (err) {
        toast(`No se pudo leer el mouse: ${err.message}`, "error");
        setInfo((i) => i && { ...i, online: false });
      }
    });
    mgr.start().catch((err) => setConn({ status: "error", error: err }));
    return () => {
      off();
      offUnsolicited?.();
    };
  }, [loadFromMouse, syncActive, toast]);

  // Polling de estado en línea (cada 2.5s) y batería periódica (~30s).
  useEffect(() => {
    if (conn.status !== "connected") return;
    let cancelled = false;
    let ticks = 0;
    let misses = 0;

    const poll = async () => {
      const mouse = mouseRef.current;
      // Durante una escritura no se compite por el canal (los timeouts parecerían desconexión).
      if (!mouse || cancelled || live.current.busy || switching.current) return;
      try {
        if (mouse.mode !== "USB") {
          const isOnline = await mouse.online();
          if (cancelled) return;
          if (!isOnline) {
            // Un solo fallo puede ser una respuesta perdida: se exigen 2 seguidos.
            if (++misses >= 2) setInfo((i) => (i ? (i.online === false ? i : { ...i, online: false }) : i));
            return;
          }
          misses = 0;
          if (live.current.info?.online === false) {
            await loadFromMouse(mouse);
            return;
          }
        }
        ticks++;
        if (ticks % 12 === 1 || !live.current.info?.battery) {
          const battery = await mouse.battery();
          if (cancelled) return;
          const lvl = Number(battery?.level);
          if (Number.isFinite(lvl) && lvl >= 1 && lvl <= 100) {
            setInfo((i) => i && { ...i, battery: { level: lvl, charging: Boolean(battery.charging) }, online: true });
          }
        } else {
          setInfo((i) => (i && i.online !== true ? { ...i, online: true } : i));
        }
      } catch {
        if (!cancelled && mouse.mode !== "USB" && ++misses >= 2) {
          setInfo((i) => (i ? { ...i, online: false } : i));
        }
      }
    };

    const t = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [conn.status, conn.mode, loadFromMouse]);

  // Al volver a la ventana se relee la configuración (el botón de luz y el de DPI la cambian).
  useEffect(() => {
    const onFocus = async () => {
      const mouse = mouseRef.current;
      if (!mouse || !live.current.config || live.current.info?.online === false) return;
      try {
        const cfg = await mouse.readConfig();
        setConfig(cfg);
        syncActive({ config: cfg });
      } catch { /* se reintentará en el próximo foco */ }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [syncActive]);

  const requestDevice = useCallback(async () => {
    try {
      await managerRef.current?.request();
    } catch (err) {
      toast(err.message, "error");
    }
  }, [toast]);

  // ---- Configuración ----

  // Por cable la web solo permite 1000 Hz y fuerza report_rate = 3 al guardar.
  const prepare = (c, mode) => (mode === "USB" ? { ...c, report_rate: 3 } : c);

  const applyConfig = useCallback(async (patch) => {
    const prev = live.current.config;
    if (!prev) return;
    const next = prepare({ ...prev, ...patch }, mouseRef.current?.mode);
    const errors = validateConfig(next);
    if (errors.length) return toast(errors.join("; "), "error");
    setConfig(next);
    try {
      await run("Guardar configuración", (m) => m.writeConfig(next));
      syncActive({ config: next });
    } catch {
      setConfig(prev);
    }
  }, [run, syncActive, toast]);

  const applyLight = useCallback(async (mode) => {
    const prev = live.current.config;
    if (!prev) return;
    const next = { ...prev, light_mode: mode };
    setConfig(next);
    try {
      await run("Cambiar iluminación", (m) => m.setLightMode(mode));
      syncActive({ config: next });
    } catch {
      setConfig(prev);
    }
  }, [run, syncActive]);

  // ---- Macros (biblioteca global, se escriben todas juntas) ----

  const writeMacros = useCallback(async () => {
    const macros = live.current.store?.macros || [];
    await run("Guardar macros", (m) => m.writeMacros(macros.map((x) => x.events)));
    setMacrosDirty(false);
    toast("Macros guardadas en el mouse");
  }, [run, toast]);

  const setMacros = useCallback((fn) => {
    setStore((s) => ({ ...s, macros: fn(s.macros) }));
    setMacrosDirty(true);
  }, [setStore]);

  const addMacro = useCallback((name) => {
    setMacros((list) => [...list, newMacro(name)]);
  }, [setMacros]);

  const deleteMacro = useCallback(async (index) => {
    const s = live.current.store;
    const next = removeMacroFromStore(s, index);
    setStore(next);
    setMacrosDirty(true);
    // Si el perfil activo usaba la macro, sus botones cambiaron: se reescriben.
    // Los índices de las macros siguientes se desplazan: se reescriben macros y botones juntos.
    const nextButtons = activeProfile(next).buttons;
    if (mouseRef.current && JSON.stringify(nextButtons) !== JSON.stringify(live.current.buttons)) {
      setButtons(nextButtons);
      try {
        await run("Actualizar botones", async (m) => {
          await m.writeMacros(next.macros.map((x) => x.events));
          await m.writeButtons(nextButtons);
        });
        setMacrosDirty(false);
      } catch { /* el error ya se mostró */ }
    }
  }, [run, setStore]);

  // ---- Botones ----

  const applyButtons = useCallback(async (next) => {
    const prev = live.current.buttons;
    setButtons(next);
    try {
      if (next.some((a) => a.kind === "macro") && live.current.macrosDirty) await writeMacros();
      await run("Guardar botones", (m) => m.writeButtons(next));
      syncActive({ buttons: next });
    } catch {
      setButtons(prev);
    }
  }, [run, syncActive, writeMacros]);

  const resetButtons = useCallback(async () => {
    const prev = live.current.buttons;
    const next = factoryButtons();
    setButtons(next);
    try {
      await run("Restablecer botones", (m) => m.resetButtons());
      syncActive({ buttons: next });
      toast("Botones restablecidos");
    } catch {
      setButtons(prev);
    }
  }, [run, syncActive, toast]);

  // ---- Perfiles ----

  const writeProfile = useCallback(async (profile) => {
    const mode = mouseRef.current?.mode;
    const cfg = prepare(profile.config, mode);
    const errors = validateConfig(cfg);
    if (errors.length) throw new Error(errors.join("; "));
    if (live.current.macrosDirty && profile.buttons.some((a) => a.kind === "macro")) await writeMacros();
    await run(`Aplicar perfil "${profile.name}"`, async (m) => {
      await m.writeConfig(cfg);
      await m.writeButtons(profile.buttons);
      await m.setLightMode(cfg.light_mode);
    });
    setConfig(cfg);
    setButtons(clone(profile.buttons));
  }, [run, writeMacros]);

  // Los cambios se encadenan: cada uno parte del estado en que dejó el anterior.
  // Devuelve true si el perfil quedó aplicado.
  const switchProfile = useCallback((id, { quiet = false } = {}) => {
    const job = switchQueue.current.then(async () => {
      const s = live.current.store;
      const profile = s?.profiles.find((p) => p.id === id);
      if (!profile || s.activeProfileId === id) return false;
      const previousId = s.activeProfileId;
      switching.current = true;
      try {
        setStore((x) => ({ ...x, activeProfileId: id }));
        if (!mouseRef.current) return true;
        try {
          await writeProfile(profile);
          if (!quiet) toast(`Perfil "${profile.name}" aplicado`);
          return true;
        } catch {
          setStore((x) => ({ ...x, activeProfileId: previousId }));
          return false;
        }
      } finally {
        switching.current = false;
      }
    });
    switchQueue.current = job.catch(() => {});
    return job;
  }, [setStore, toast, writeProfile]);

  const createProfile = useCallback((name) => {
    const s = live.current.store;
    const base = activeProfile(s);
    const p = newProfile(name, live.current.config || base.config, live.current.buttons || base.buttons);
    setStore((x) => ({ ...addProfile(x, p), activeProfileId: p.id }));
    toast(`Perfil "${name}" creado con la configuración actual`);
  }, [setStore, toast]);

  const renameProfile = useCallback((id, name) => setStore((s) => updateProfile(s, id, { name })), [setStore]);

  const duplicateProfile = useCallback((id) => {
    const s = live.current.store;
    const p = s.profiles.find((x) => x.id === id);
    if (!p) return;
    const cloned = newProfile(`${p.name} (copia)`, p.config, p.buttons);
    setStore((x) => addProfile(x, cloned));
    toast(`Perfil "${cloned.name}" duplicado`);
  }, [setStore, toast]);

  const deleteProfile = useCallback(async (id) => {
    const s = live.current.store;
    const wasActive = s.activeProfileId === id;
    let next;
    try {
      next = removeProfile(s, id);
    } catch (err) {
      return toast(err.message, "error");
    }
    setStore(next);
    if (wasActive && mouseRef.current) await writeProfile(activeProfile(next)).catch(() => {});
  }, [setStore, toast, writeProfile]);

  const exportProfileFile = useCallback(async (id) => {
    const s = live.current.store;
    const p = s.profiles.find((x) => x.id === id);
    const file = await api.exportProfile(exportProfile(s, id), p.name).catch((err) => toast(err.message, "error"));
    if (file) toast(`Perfil exportado: ${file}`);
  }, [toast]);

  const importProfileFile = useCallback(async () => {
    try {
      const data = await api.importProfile();
      if (!data) return;
      const next = importProfile(live.current.store, data);
      setStore(next);
      if (data.macros?.length) setMacrosDirty(true);
      toast(`Perfil "${next.profiles.at(-1).name}" importado`);
    } catch (err) {
      toast(`No se pudo importar: ${err.message}`, "error");
    }
  }, [setStore, toast]);

  // ---- Cambio automático por ventana activa ----

  const autoEnabled = Boolean(store?.autoSwitch.enabled);
  useEffect(() => {
    if (!store) return;
    api.setAutoSwitch(autoEnabled);
  }, [autoEnabled, Boolean(store)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const off = api.onForeground((exe) => {
      setForeground(exe);
      const s = live.current.store;
      if (!s?.autoSwitch.enabled) return;
      const id = profileForExecutable(s, exe);
      if (id && id !== s.activeProfileId) switchProfile(id, { quiet: true }).then((ok) => {
        const p = s.profiles.find((x) => x.id === id);
        if (ok && p) toast(`${exe} → perfil "${p.name}"`);
      });
    });
    const offErr = api.onForegroundError((msg) => console.warn("ventana activa:", msg));
    return () => {
      off();
      offErr();
    };
  }, [switchProfile, toast]);

  const setAutoSwitch = useCallback((patch) => {
    setStore((s) => ({ ...s, autoSwitch: { ...s.autoSwitch, ...patch } }));
  }, [setStore]);

  // ---- Fábrica ----

  const factoryReset = useCallback(async () => {
    try {
      await run("Restaurar valores de fábrica", (m) => m.factoryReset());
      const mouse = mouseRef.current;
      await loadFromMouse(mouse);
      toast("Valores de fábrica restaurados");
    } catch { /* el error ya se mostró */ }
  }, [loadFromMouse, run, toast]);

  return {
    conn, info, config, buttons, store, busy, toasts, backup, foreground, macrosDirty,
    requestDevice, applyConfig, applyLight, applyButtons, resetButtons,
    setMacros, addMacro, deleteMacro, writeMacros,
    switchProfile, createProfile, renameProfile, duplicateProfile, deleteProfile, exportProfileFile, importProfileFile, setAutoSwitch,
    factoryReset, toast,
  };
}

