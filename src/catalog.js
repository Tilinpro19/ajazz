// Catálogo de acciones, efectos y teclas para la UI. Los códigos salen del JSON `j.B.p`
// de la web oficial y de la tabla de usos HID estándar (ver docs/PROTOCOL.md).

// Nombres físicos de los 8 botones, en el orden de la tabla del mouse.
export const BUTTON_NAMES = [
  "Clic izquierdo", "Clic derecho", "Clic central", "Atrás", "Adelante", "Botón DPI", "Rueda arriba", "Rueda abajo",
];

export const MOUSE_ACTIONS = [
  { label: "Clic izquierdo", action: { kind: "mouse", mask: 1 } },
  { label: "Clic derecho", action: { kind: "mouse", mask: 2 } },
  { label: "Clic central", action: { kind: "mouse", mask: 4 } },
  { label: "Atrás", action: { kind: "mouse", mask: 8 } },
  { label: "Adelante", action: { kind: "mouse", mask: 0x10 } },
  { label: "Rueda arriba", action: { kind: "wheel", dir: 1 } },
  { label: "Rueda abajo", action: { kind: "wheel", dir: -1 } },
  { label: "Ciclo de DPI", action: { kind: "dpi" } },
  { label: "Deshabilitado", action: { kind: "mouse", mask: 0 } },
];

// Códigos "consumer" HID (16 bits).
export const MEDIA_ACTIONS = [
  { label: "Volumen +", usage: 0xe9 },
  { label: "Volumen -", usage: 0xea },
  { label: "Silenciar", usage: 0xe2 },
  { label: "Reproducir/Pausa", usage: 0xcd },
  { label: "Detener", usage: 0xb7 },
  { label: "Pista anterior", usage: 0xb6 },
  { label: "Pista siguiente", usage: 0xb5 },
  { label: "Reproductor multimedia", usage: 0x183 },
  { label: "Página de inicio", usage: 0x223 },
  { label: "Recargar página", usage: 0x227 },
  { label: "Detener página", usage: 0x226 },
  { label: "Página siguiente", usage: 0x225 },
  { label: "Página anterior", usage: 0x224 },
  { label: "Favoritos", usage: 0x22a },
  { label: "Buscar", usage: 0x221 },
  { label: "Calculadora", usage: 0x192 },
  { label: "Mi PC", usage: 0x194 },
  { label: "Correo", usage: 0x18a },
].map((m) => ({ ...m, action: { kind: "media", usage: m.usage } }));

// Modificadores del byte 1 de una acción de teclado.
export const MODIFIERS = [
  { label: "Ctrl", bit: 0x01 },
  { label: "Shift", bit: 0x02 },
  { label: "Alt", bit: 0x04 },
  { label: "Win", bit: 0x08 },
];
const RIGHT_MODIFIERS = [
  { label: "Ctrl der.", bit: 0x10 }, { label: "Shift der.", bit: 0x20 }, { label: "Alt der.", bit: 0x40 }, { label: "Win der.", bit: 0x80 },
];

// KeyboardEvent.code -> [uso HID, etiqueta].
const KEY_TABLE = [];
for (let i = 0; i < 26; i++) KEY_TABLE.push([`Key${String.fromCharCode(65 + i)}`, 4 + i, String.fromCharCode(65 + i)]);
for (let i = 1; i <= 9; i++) KEY_TABLE.push([`Digit${i}`, 29 + i, String(i)]);
KEY_TABLE.push(["Digit0", 39, "0"]);
KEY_TABLE.push(
  ["Enter", 40, "Enter"], ["Escape", 41, "Esc"], ["Backspace", 42, "Retroceso"], ["Tab", 43, "Tab"], ["Space", 44, "Espacio"],
  ["Minus", 45, "-"], ["Equal", 46, "="], ["BracketLeft", 47, "["], ["BracketRight", 48, "]"], ["Backslash", 49, "\\"],
  ["IntlHash", 50, "# (ISO)"], ["Semicolon", 51, "Ñ / ;"], ["Quote", 52, "'"], ["Backquote", 53, "`"], ["Comma", 54, ","],
  ["Period", 55, "."], ["Slash", 56, "/"], ["CapsLock", 57, "Bloq Mayús"],
);
for (let i = 1; i <= 12; i++) KEY_TABLE.push([`F${i}`, 57 + i, `F${i}`]);
KEY_TABLE.push(
  ["PrintScreen", 70, "Impr Pant"], ["ScrollLock", 71, "Bloq Despl"], ["Pause", 72, "Pausa"], ["Insert", 73, "Insert"],
  ["Home", 74, "Inicio"], ["PageUp", 75, "Re Pág"], ["Delete", 76, "Supr"], ["End", 77, "Fin"], ["PageDown", 78, "Av Pág"],
  ["ArrowRight", 79, "→"], ["ArrowLeft", 80, "←"], ["ArrowDown", 81, "↓"], ["ArrowUp", 82, "↑"], ["NumLock", 83, "Bloq Num"],
  ["NumpadDivide", 84, "Num /"], ["NumpadMultiply", 85, "Num *"], ["NumpadSubtract", 86, "Num -"], ["NumpadAdd", 87, "Num +"],
  ["NumpadEnter", 88, "Num Enter"],
);
for (let i = 1; i <= 9; i++) KEY_TABLE.push([`Numpad${i}`, 88 + i, `Num ${i}`]);
KEY_TABLE.push(["Numpad0", 98, "Num 0"], ["NumpadDecimal", 99, "Num ."], ["IntlBackslash", 100, "< >"], ["ContextMenu", 101, "Menú"]);
for (let i = 13; i <= 24; i++) KEY_TABLE.push([`F${i}`, 91 + i, `F${i}`]);
KEY_TABLE.push(
  ["ControlLeft", 224, "Ctrl izq."], ["ShiftLeft", 225, "Shift izq."], ["AltLeft", 226, "Alt izq."], ["MetaLeft", 227, "Win izq."],
  ["ControlRight", 228, "Ctrl der."], ["ShiftRight", 229, "Shift der."], ["AltRight", 230, "Alt der."], ["MetaRight", 231, "Win der."],
);

export const KEYS = KEY_TABLE.map(([code, usage, label]) => ({ code, usage, label }));
const byCode = new Map(KEYS.map((k) => [k.code, k]));
const byUsage = new Map(KEYS.map((k) => [k.usage, k]));

export const keyFromEvent = (e) => byCode.get(e.code) || null;
export const keyLabel = (usage) => byUsage.get(usage)?.label ?? `Tecla 0x${usage.toString(16)}`;

// Modificador -> bit de la acción de teclado (para capturar combinaciones con teclas sueltas).
const MOD_BITS = { 224: 0x01, 225: 0x02, 226: 0x04, 227: 0x08, 228: 0x10, 229: 0x20, 230: 0x40, 231: 0x80 };
export const modifierBit = (usage) => MOD_BITS[usage] || 0;

// Botones del mouse en macros (máscaras) y su equivalente en MouseEvent.button.
export const MACRO_MOUSE_BUTTONS = [
  { label: "Clic izquierdo", code: 1, button: 0 },
  { label: "Clic central", code: 4, button: 1 },
  { label: "Clic derecho", code: 2, button: 2 },
  { label: "Atrás", code: 8, button: 3 },
  { label: "Adelante", code: 0x10, button: 4 },
];
export const mouseButtonFromEvent = (e) => MACRO_MOUSE_BUTTONS.find((b) => b.button === e.button) || null;
export const mouseButtonLabel = (code) => MACRO_MOUSE_BUTTONS.find((b) => b.code === code)?.label ?? `Botón 0x${code.toString(16)}`;

export const MACRO_LOOP_MODES = [
  { value: 0, label: "Repetir N veces" },
  { value: 2, label: "Repetir mientras se mantiene pulsado" },
  { value: 3, label: "Repetir hasta pulsar otra tecla" },
];

// Orden observado con el mouse (0 = arcoíris, 5 = respiración, 6 = apagado). Nombres de la web.
export const LIGHT_EFFECTS = [
  { value: 0, label: "Ola", hint: "Arcoíris que recorre el mouse" },
  { value: 1, label: "Neón", hint: "Colores que pasan uno por uno" },
  { value: 2, label: "Destello cíclico", hint: "Arcoíris más rápido" },
  { value: 3, label: "Bola YOYO", hint: "Sin confirmar con el mouse" },
  { value: 4, label: "Destello simple", hint: "Sin confirmar con el mouse" },
  { value: 5, label: "Respiración", hint: "Un color aparece y se desvanece" },
  { value: 6, label: "Apagado", hint: "Sin luces" },
];

export const REPORT_RATES = [
  { value: 0, hz: 125 }, { value: 1, hz: 250 }, { value: 2, hz: 500 }, { value: 3, hz: 1000 },
];

export const SLEEP_MINUTES = [1, 3, 5, 10, 20, 30, 60];

export const SENSOR_BITS = [
  { bit: 0x01, label: "Control de ondulación", hint: "Reduce el efecto de ondas del sensor por encima de 9000 DPI." },
  { bit: 0x10, label: "Corrección lineal", hint: "Corrige pequeñas desviaciones para que el movimiento sea recto." },
  { bit: 0x20, label: "Motion Sync", hint: "Sincroniza los datos del sensor con el ciclo de reporte." },
];

export const LOD_OPTIONS = [{ value: 1, label: "Baja (1 mm)" }, { value: 2, label: "Alta (2 mm)" }];

// Texto legible de una acción decodificada (decodeAction).
export function describeAction(a, macroNames = []) {
  switch (a.kind) {
    case "mouse": return MOUSE_ACTIONS.find((m) => m.action.kind === "mouse" && m.action.mask === a.mask)?.label ?? `Mouse 0x${a.mask.toString(16)}`;
    case "wheel": return a.dir > 0 ? "Rueda arriba" : "Rueda abajo";
    case "dpi": return "Ciclo de DPI";
    case "media": return MEDIA_ACTIONS.find((m) => m.usage === a.usage)?.label ?? `Multimedia 0x${a.usage.toString(16)}`;
    case "keyboard": {
      const mods = [...MODIFIERS, ...RIGHT_MODIFIERS].filter((m) => a.modifiers & m.bit).map((m) => m.label);
      return [...mods, ...(a.usage ? [keyLabel(a.usage)] : [])].join(" + ") || "Teclado (vacío)";
    }
    case "macro": {
      const name = macroNames[a.index] ?? `Macro ${a.index + 1}`;
      const loop = a.loop === 0 ? (a.count > 1 ? ` ×${a.count}` : "") : a.loop === 2 ? " (mientras se pulsa)" : " (hasta otra tecla)";
      return `Macro: ${name}${loop}`;
    }
    default: return `Desconocido (${a.bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ")})`;
  }
}
