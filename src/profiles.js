// Perfiles guardados en disco (JSON con versión de esquema). Funciones puras: el acceso
// a disco lo hace electron/main.js. Las macros son globales (el mouse guarda una sola
// memoria de macros) y su índice en `store.macros` es el que usan las acciones de botón.
import { FACTORY_CONFIG, FACTORY_BUTTONS, decodeAction, validateConfig } from "./protocol.js";

export const SCHEMA_VERSION = 1;
export const EXPORT_FORMAT = "aj139-profile";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const clone = (v) => JSON.parse(JSON.stringify(v));

export const factoryButtons = () => FACTORY_BUTTONS.map((b) => decodeAction(b));

export function newProfile(name, config = FACTORY_CONFIG, buttons = factoryButtons()) {
  return { id: uid(), name, config: clone(config), buttons: clone(buttons) };
}

export function createStore(profile = newProfile("Predeterminado")) {
  return {
    schema: SCHEMA_VERSION,
    activeProfileId: profile.id,
    profiles: [profile],
    macros: [],
    autoSwitch: { enabled: false, defaultProfileId: profile.id, rules: [] },
  };
}

// Migraciones por versión. Para agregar la v2: MIGRATIONS[1] = (s) => ({ ...s, schema: 2, ... }).
const MIGRATIONS = {
  // v0: archivo sin `schema` (solo una lista de perfiles).
  0: (s) => {
    const profiles = Array.isArray(s) ? s : s.profiles || [];
    const base = profiles.length ? profiles : [newProfile("Predeterminado")];
    return { ...createStore(base[0]), profiles: base, macros: s.macros || [] };
  },
};

export function migrate(raw) {
  if (!raw) return createStore();
  let s = clone(raw);
  let version = Number.isInteger(s.schema) ? s.schema : 0;
  if (version > SCHEMA_VERSION) throw new Error(`el archivo es de una versión más nueva de la app (esquema ${version})`);
  while (version < SCHEMA_VERSION) {
    s = MIGRATIONS[version](s);
    version = s.schema;
  }
  return normalize(s);
}

// Repara referencias rotas para que la app siempre arranque con un estado usable.
function normalize(s) {
  if (!s.profiles.length) s.profiles.push(newProfile("Predeterminado"));
  for (const p of s.profiles) {
    if (validateConfig(p.config).length) p.config = clone(FACTORY_CONFIG);
    if (!Array.isArray(p.buttons) || p.buttons.length !== 8) p.buttons = factoryButtons();
  }
  const ids = new Set(s.profiles.map((p) => p.id));
  if (!ids.has(s.activeProfileId)) s.activeProfileId = s.profiles[0].id;
  s.autoSwitch ||= { enabled: false, rules: [] };
  if (!ids.has(s.autoSwitch.defaultProfileId)) s.autoSwitch.defaultProfileId = s.activeProfileId;
  s.autoSwitch.rules = (s.autoSwitch.rules || []).filter((r) => ids.has(r.profileId));
  s.macros ||= [];
  return s;
}

export const activeProfile = (s) => s.profiles.find((p) => p.id === s.activeProfileId);

export function updateProfile(s, id, patch) {
  return { ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...clone(patch) } : p)) };
}

export function addProfile(s, profile) {
  return { ...s, profiles: [...s.profiles, profile] };
}

export function removeProfile(s, id) {
  if (s.profiles.length === 1) throw new Error("debe quedar al menos un perfil");
  return normalize({ ...clone(s), profiles: s.profiles.filter((p) => p.id !== id).map(clone) });
}

// Al borrar una macro, los botones que la usaban vuelven a su acción de fábrica
// y los índices de las macros siguientes bajan uno.
export function removeMacro(s, index) {
  const defaults = factoryButtons();
  const profiles = s.profiles.map((p) => ({
    ...p,
    buttons: p.buttons.map((a, i) => {
      if (a.kind !== "macro" || a.index < index) return a;
      return a.index === index ? defaults[i] : { ...a, index: a.index - 1 };
    }),
  }));
  return { ...s, profiles, macros: s.macros.filter((_, i) => i !== index) };
}

// Archivo de exportación: el perfil y solo las macros que usa.
export function exportProfile(s, id) {
  const p = s.profiles.find((x) => x.id === id);
  const used = [...new Set(p.buttons.filter((a) => a.kind === "macro").map((a) => a.index))].sort((a, b) => a - b);
  const remap = new Map(used.map((old, i) => [old, i]));
  return {
    format: EXPORT_FORMAT,
    schema: SCHEMA_VERSION,
    profile: { name: p.name, config: clone(p.config),
      buttons: p.buttons.map((a) => (a.kind === "macro" ? { ...a, index: remap.get(a.index) } : a)) },
    macros: used.map((i) => clone(s.macros[i])).filter(Boolean),
  };
}

// Agrega el perfil importado (con id nuevo) y sus macros al final de la biblioteca.
export function importProfile(s, data) {
  if (data?.format !== EXPORT_FORMAT) throw new Error("no es un archivo de perfil de AJAZZ AJ139 Control");
  if (data.schema > SCHEMA_VERSION) throw new Error("el perfil es de una versión más nueva de la app");
  const errors = validateConfig(data.profile?.config);
  if (errors.length) throw new Error(`perfil inválido: ${errors.join("; ")}`);
  if (!Array.isArray(data.profile.buttons) || data.profile.buttons.length !== 8) throw new Error("perfil inválido: botones");
  const offset = s.macros.length;
  const macros = (data.macros || []).map((m) => ({ ...clone(m), id: uid() }));
  const buttons = data.profile.buttons.map((a) => (a.kind === "macro" ? { ...a, index: a.index + offset } : a));
  const profile = { ...newProfile(data.profile.name || "Importado", data.profile.config, buttons) };
  return { ...s, profiles: [...s.profiles, profile], macros: [...s.macros, ...macros] };
}

// Regla de cambio automático: nombre del ejecutable (sin distinguir mayúsculas) -> perfil.
export function profileForExecutable(s, exe) {
  const name = (exe || "").toLowerCase();
  const rule = s.autoSwitch.rules.find((r) => r.exe.toLowerCase() === name);
  return rule ? rule.profileId : s.autoSwitch.defaultProfileId;
}

export const newMacro = (name) => ({ id: uid(), name, events: [] });
