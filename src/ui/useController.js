// Estado de la app: conexión, datos leídos del mouse, perfiles y acciones de la UI.
// Regla: el mouse es la fuente de verdad al conectar (no se escribe nada al arrancar);
// cada cambio se valida, se aplica de forma optimista y se revierte si el mouse no responde.
import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceManager } from "../device/hid.js";
import { Mouse, SUPPORTED_FIRMWARE } from "../device/mouse.js";
import { validateConfig } from "../protocol.js";
import {
  migrate, activeProfile, updateProfile, addProfile, removeProfile, newProfile, exportProfile,
  importProfile, profileForExecutable, removeMacro as removeMacroFromStore, newMacro, factoryButtons,
} from "../profiles.js";
import { api } from "./api.js";

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
  live.current = { config, buttons, store, info, macrosDirty };
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
    api.loadStore()
      .then((raw) => setStoreState(migrate(raw)))
      .catch((err) => {
        toast(`No se pudieron leer los perfiles: ${err.message}`, "error");
        setStoreState(migrate(null));
      });
  }, [toast]);

  useEffect(() => {
    if (!store) return;
    const t = setTimeout(() => api.saveStore(store).catch((err) => toast(`No se guardaron los perfiles: ${err.message}`, "error")), 300);
    return () => clearTimeout(t);
  }, [store, toast]);

  // Guarda en el perfil activo lo que hay ahora en el mouse.
  const syncActive = useCallback((patch) => {
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
    setInfo((i) => ({ ...i, firmware, battery, online: true }));
    setConfig(cfg);
    setButtons(btns.map((b) => b.action));
    syncActive({ config: cfg, buttons: btns.map((b) => b.action) });
    api.ensureBackup({ date: new Date().toISOString(), mode: mouse.mode, firmware, config: cfg, buttons: btns.map((b) => b.bytes) })
      .then(setBackup)
      .catch(() => {});
    if (firmware !== SUPPORTED_FIRMWARE) toast(`Firmware ${firmware}: la app se probó con ${SUPPORTED_FIRMWARE}. Algunas opciones podrían no funcionar.`, "warn");
    return true;
  }, [syncActive, toast]);

  useEffect(() => {
    if (!navigator.hid) {
      setConn({ status: "error", error: new Error("WebHID no está disponible en este entorno") });
      return;
    }
    const mgr = new DeviceManager(navigator.hid);
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
      const mouse = new Mouse(state.transport, { mode: state.mode, name: state.device.productName });
      mouseRef.current = mouse;
      setInfo({ mode: state.mode, name: state.device.productName || "AJ139 V2 MC", online: null });
      offUnsolicited = state.transport.on("unsolicited", (ev) => {
        if (ev.type === "battery") setInfo((i) => i && { ...i, battery: { level: ev.level, charging: ev.charging } });
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

  // Batería cada minuto; con el dongle, espera a que el mouse se encienda.
  useEffect(() => {
    if (conn.status !== "connected") return;
    const offline = info?.online === false;
    const t = setInterval(async () => {
      const mouse = mouseRef.current;
      if (!mouse) return;
      try {
        if (offline) {
          if (await mouse.online()) await loadFromMouse(mouse);
        } else {
          const battery = await mouse.battery();
          setInfo((i) => i && { ...i, battery });
        }
      } catch {
        if (mouse.mode !== "USB") setInfo((i) => i && { ...i, online: false });
      }
    }, offline ? ONLINE_POLL_MS : BATTERY_POLL_MS);
    return () => clearInterval(t);
  }, [conn.status, info?.online, loadFromMouse]);

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
      toast(`No se encontró el mouse: ${err.message}`, "error");
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
    const nextButtons = activeProfile(next).buttons;
    if (mouseRef.current && JSON.stringify(nextButtons) !== JSON.stringify(live.current.buttons)) {
      setButtons(nextButtons);
      await run("Actualizar botones", (m) => m.writeButtons(nextButtons)).catch(() => {});
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

  const switchProfile = useCallback(async (id, { quiet = false } = {}) => {
    const s = live.current.store;
    const profile = s?.profiles.find((p) => p.id === id);
    if (!profile || s.activeProfileId === id) return;
    if (!mouseRef.current) {
      setStore((x) => ({ ...x, activeProfileId: id }));
      return;
    }
    try {
      await writeProfile(profile);
      setStore((x) => ({ ...x, activeProfileId: id }));
      if (!quiet) toast(`Perfil "${profile.name}" aplicado`);
    } catch { /* el error ya se mostró */ }
  }, [setStore, toast, writeProfile]);

  const createProfile = useCallback((name) => {
    const s = live.current.store;
    const base = activeProfile(s);
    const p = newProfile(name, live.current.config || base.config, live.current.buttons || base.buttons);
    setStore((x) => ({ ...addProfile(x, p), activeProfileId: p.id }));
    toast(`Perfil "${name}" creado con la configuración actual`);
  }, [setStore, toast]);

  const renameProfile = useCallback((id, name) => setStore((s) => updateProfile(s, id, { name })), [setStore]);

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
      if (id && id !== s.activeProfileId) switchProfile(id, { quiet: true }).then(() => {
        const p = s.profiles.find((x) => x.id === id);
        if (p) toast(`${exe} → perfil "${p.name}"`);
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
    switchProfile, createProfile, renameProfile, deleteProfile, exportProfileFile, importProfileFile, setAutoSwitch,
    factoryReset, toast,
  };
}

