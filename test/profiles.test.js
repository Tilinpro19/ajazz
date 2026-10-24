import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCHEMA_VERSION, createStore, migrate, newProfile, newMacro, addProfile, removeProfile, removeMacro,
  exportProfile, importProfile, profileForExecutable, activeProfile, factoryButtons,
} from "../src/profiles.js";
import { FACTORY_CONFIG } from "../src/protocol.js";

const withMacros = () => {
  let s = createStore();
  s.macros = [newMacro("A"), newMacro("B"), newMacro("C")];
  const p = activeProfile(s);
  p.buttons[3] = { kind: "macro", index: 1, count: 1, loop: 0 };
  p.buttons[4] = { kind: "macro", index: 2, count: 1, loop: 2 };
  return s;
};

test("createStore y migrate de un archivo vacío o sin versión", () => {
  const s = createStore();
  assert.equal(s.schema, SCHEMA_VERSION);
  assert.equal(activeProfile(s).name, "Predeterminado");
  assert.deepEqual(activeProfile(s).config, FACTORY_CONFIG);
  const v0 = migrate([{ id: "x", name: "Viejo", config: FACTORY_CONFIG, buttons: factoryButtons() }]);
  assert.equal(v0.schema, SCHEMA_VERSION);
  assert.equal(v0.profiles[0].name, "Viejo");
  assert.equal(v0.activeProfileId, "x");
  assert.throws(() => migrate({ schema: SCHEMA_VERSION + 1 }), /más nueva/);
});

test("migrate repara configuraciones inválidas y referencias rotas", () => {
  const s = createStore();
  s.profiles[0].config = { dpi: [] };
  s.activeProfileId = "no-existe";
  s.autoSwitch.rules = [{ exe: "game.exe", profileId: "no-existe" }];
  const m = migrate(s);
  assert.deepEqual(m.profiles[0].config, FACTORY_CONFIG);
  assert.equal(m.activeProfileId, m.profiles[0].id);
  assert.deepEqual(m.autoSwitch.rules, []);
});

test("removeMacro restaura los botones que la usaban y reindexa", () => {
  const s = removeMacro(withMacros(), 1);
  const p = activeProfile(s);
  assert.deepEqual(s.macros.map((m) => m.name), ["A", "C"]);
  assert.deepEqual(p.buttons[3], factoryButtons()[3]);
  assert.equal(p.buttons[4].index, 1);
});

test("exportar e importar un perfil con sus macros", () => {
  const s = withMacros();
  const file = exportProfile(s, s.activeProfileId);
  assert.deepEqual(file.macros.map((m) => m.name), ["B", "C"]);
  assert.equal(file.profile.buttons[3].index, 0);
  const target = { ...createStore(), macros: [newMacro("X")] };
  const out = importProfile(target, JSON.parse(JSON.stringify(file)));
  assert.equal(out.profiles.length, 2);
  assert.deepEqual(out.macros.map((m) => m.name), ["X", "B", "C"]);
  assert.equal(out.profiles[1].buttons[3].index, 1);
  assert.equal(out.profiles[1].buttons[4].index, 2);
  assert.throws(() => importProfile(target, { format: "otro" }), /no es un archivo/);
  assert.throws(() => importProfile(target, { ...file, profile: { ...file.profile, config: { dpi: [] } } }), /inválido/);
});

test("removeProfile mantiene al menos uno y corrige el activo", () => {
  let s = createStore();
  const p2 = newProfile("Juegos");
  s = addProfile(s, p2);
  s.activeProfileId = p2.id;
  s = removeProfile(s, p2.id);
  assert.equal(s.profiles.length, 1);
  assert.equal(s.activeProfileId, s.profiles[0].id);
  assert.throws(() => removeProfile(s, s.profiles[0].id));
});

test("profileForExecutable usa la regla o el perfil por defecto", () => {
  let s = createStore();
  const p2 = newProfile("Juegos");
  s = addProfile(s, p2);
  s.autoSwitch.rules = [{ exe: "Game.exe", profileId: p2.id }];
  assert.equal(profileForExecutable(s, "game.EXE"), p2.id);
  assert.equal(profileForExecutable(s, "explorer.exe"), s.autoSwitch.defaultProfileId);
});
