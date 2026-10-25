// Codificación y decodificación pura del protocolo del AJ139 V2 MC.
// Sin dependencias de WebHID: se prueba en Node. Ver docs/PROTOCOL.md.

export const VENDOR_IDS = [43172, 43173]; // USB cable, dongle 2.4G
export const PRODUCT_ID = 8789;
export const USAGE_PAGE = 65281;
export const USAGE = 16;

const MAGIC = 0x55;
const FRAME_LEN = 65;
const MACRO_SIZE = 4096;
const MACRO_CHUNK = 56;

const blank = (len = FRAME_LEN) => Array(len).fill(0);

const lo = (v) => v & 0xff;
const hi = (v) => v >> 8;

export function toWord(lowByte, highByte) {
  return lowByte + highByte * 256;
}

export const cmd = {
  version() {
    const f = blank();
    f[1] = MAGIC; f[2] = 0x03;
    return f;
  },

  battery() {
    const f = blank();
    [f[1], f[2], f[3], f[4], f[5], f[6], f[7]] = [MAGIC, 0x30, 0xa5, 0x0b, 0x2e, 1, 1];
    return f;
  },

  online() {
    const f = blank();
    [f[1], f[2], f[3], f[4], f[5], f[6]] = [MAGIC, 0xed, 0, 1, 0x2e, 0];
    return f;
  },

  setLightMode(mode) {
    const f = blank();
    [f[1], f[2], f[3], f[4], f[5], f[6], f[11]] = [MAGIC, 0x21, 0, 0, 3, 0, mode];
    return f;
  },

  readConfig() {
    const f = blank();
    [f[1], f[2], f[3], f[4], f[5], f[6], f[7]] = [MAGIC, 0x0e, 0xa5, 0x0b, 0x2f, 1, 1];
    return f;
  },

  // Recibe el objeto de configuración que devuelve decodeConfig.
  writeConfig(c) {
    const f = blank();
    [f[1], f[2], f[3], f[4], f[5], f[6], f[7]] = [MAGIC, 0x0f, 0xae, 0x0a, 0x2f, 1, 1];
    f[10] = c.light_mode;
    f[11] = c.report_rate + 1;
    f[12] = c.dpi_count;
    f[13] = c.dpi_index + 1;
    c.dpi.forEach((value, i) => {
      f[14 + i * 2] = lo(value);
      f[15 + i * 2] = hi(value);
    });
    f[49] = c.scroll_flag;
    f[50] = c.lod_value;
    f[51] = c.sensor_flag;
    f[52] = c.key_respond;
    f[53] = c.sleep_light;
    f[54] = c.highspeed_mode;
    f[55] = c.wakeup_flag; // verificado contra el sendReport real de la web (captures/12)
    return f;
  },

  readButtons() {
    const f = blank();
    [f[1], f[2], f[3], f[4], f[5]] = [MAGIC, 0x08, 0xa5, 0x0b, 0x20];
    return f;
  },

  macroRead(address, length) {
    return [6, 12, length, lo(address), hi(address)];
  },

  macroReset() {
    return [6, 15, 4];
  },
};

// Valores de fábrica que la web usa cuando el mouse responde con 0x00 o 0xFF.
// Respuesta de readConfig: los índices están desplazados -1 respecto a writeConfig
// (la respuesta no incluye el Report ID). Ver docs/PROTOCOL.md.
export const DEFAULT_CONFIG = {
  light_mode: 2,
  report_rate: 3,
  dpi_index: 1,
  dpi_count: 5,
  dpi: [400, 800, 1200, 1600, 2400, 3200],
  scroll_flag: 0,
  lod_value: 1,
  sensor_flag: 53,
  key_respond: 4,
  sleep_light: 10,
  highspeed_mode: 0,
  wakeup_flag: 0,
};

export function decodeConfig(resp) {
  const allZero = [13, 14, 15].every((i) => resp[i] === 0);
  const allFF = [13, 14, 15].every((i) => resp[i] === 255);
  if (allZero || allFF) return { ...DEFAULT_CONFIG, dpi: [...DEFAULT_CONFIG.dpi] };
  return {
    light_mode: resp[9],
    report_rate: resp[10] - 1,
    dpi_index: resp[12] - 1,
    dpi_count: resp[11],
    dpi: [0, 1, 2, 3, 4, 5].map((i) => toWord(resp[13 + i * 2], resp[14 + i * 2])),
    scroll_flag: resp[48], // 0 = normal, 1 = invertido (confirmado)
    lod_value: resp[49],
    sensor_flag: resp[50],
    key_respond: resp[51],
    sleep_light: resp[52], // minutos de suspensión (confirmado)
    highspeed_mode: resp[53],
    wakeup_flag: resp[55], // 0 = despierta al mover, 1 = no (confirmado)
  };
}

// Respuesta de 64 bytes de readButtons: 8 entradas de 4 bytes desde el índice 8.
// `FF FF FF FF` = nunca tocado desde la web: se trata como la entrada de fábrica.
export function decodeButtons(resp) {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const o = 8 + i * 4;
    const raw = [resp[o], resp[o + 1], resp[o + 2], resp[o + 3]];
    const factory = raw.every((b) => b === 0xff);
    const bytes = factory ? [...FACTORY_BUTTONS[i]] : raw;
    out.push({ bytes, factory, action: decodeAction(bytes) });
  }
  return out;
}

const isByte = (v) => Number.isInteger(v) && v >= 0 && v <= 255;

// Valida el objeto de configuración antes de enviarlo al mouse.
export function validateConfig(c) {
  const errors = [];
  if (!c || typeof c !== "object") return ["configuración vacía"];
  if (!Array.isArray(c.dpi) || c.dpi.length !== 6) errors.push("dpi debe tener 6 valores");
  if (!Number.isInteger(c.dpi_count) || c.dpi_count < 1 || c.dpi_count > 6) errors.push("dpi_count debe estar entre 1 y 6");
  if (!Number.isInteger(c.dpi_index) || c.dpi_index < 0 || c.dpi_index >= c.dpi_count) errors.push("dpi_index fuera de rango");
  if (!Number.isInteger(c.report_rate) || c.report_rate < 0 || c.report_rate > 3) errors.push("report_rate fuera de rango (0-3)");
  if (!Number.isInteger(c.light_mode) || c.light_mode < 0 || c.light_mode > 6) errors.push("light_mode fuera de rango (0-6)");
  for (const v of c.dpi || []) {
    if (!Number.isInteger(v) || v < 50 || v > 24000) errors.push(`DPI inválido: ${v}`);
  }
  for (const k of ["scroll_flag", "lod_value", "sensor_flag", "key_respond", "sleep_light", "highspeed_mode", "wakeup_flag"]) {
    if (!isByte(c[k])) errors.push(`${k} debe ser un byte (0-255)`);
  }
  return errors;
}

// Divide el buffer de macros en bloques de escritura (cabecera + datos).
export function macroWriteFrames(data) {
  if (data.length > MACRO_SIZE) throw new RangeError("macro demasiado grande");
  const frames = [];
  for (let off = 0; off < data.length; off += MACRO_CHUNK) {
    const chunk = data.slice(off, off + MACRO_CHUNK);
    const f = [0, MAGIC, 0x0d, 0, 0, chunk.length, lo(off), hi(off), 0, ...chunk];
    frames.push(f);
  }
  frames.push([0, MAGIC, 0x10, 0xa5, 0x22, 0, 0, 0, 5]);
  return frames;
}

// Lista de bloques de lectura de macros: 4096 bytes en trozos de 56.
export function macroReadRequests() {
  const reqs = [];
  for (let off = 0; off < MACRO_SIZE; off += MACRO_CHUNK) {
    reqs.push(cmd.macroRead(off, Math.min(MACRO_SIZE - off, MACRO_CHUNK)));
  }
  return reqs;
}

// Respuesta de 64 bytes: r[0] = 0xAA, r[1] = eco del comando, r[4] = longitud de
// los datos (desde r[8]) y r[3] = suma de r[4 .. 7 + longitud] mod 256
// (confirmado con hardware).
export function responseChecksum(resp) {
  const end = Math.min(8 + resp[4], resp.length);
  let sum = 0;
  for (let i = 4; i < end; i++) sum += resp[i];
  return sum & 0xff;
}

export function isValidResponse(resp, command) {
  return resp.length === 64 && resp[0] === 0xaa && resp[1] === command &&
    resp[3] === responseChecksum(resp);
}

// Convierte un frame de 65 bytes en (reportId, payload de 64) para sendReport.
export function splitFrame(frame) {
  return { reportId: frame[0], payload: Uint8Array.from(frame.slice(1)) };
}


// Escritura de la tabla de botones (comando 0x09): 8 entradas de 4 bytes desde f[9].
// `len` es 0x31 en asignaciones y 0x20 en "Reset All Keys" / fábrica.
// Confirmado contra el sendReport real de la web (captures/12 y 13).
cmd.writeButtons = (entries, len = 0x31) => {
  if (entries.length !== 8) throw new RangeError("se necesitan 8 entradas de botón");
  const f = blank();
  [f[1], f[2], f[3], f[4], f[5]] = [MAGIC, 0x09, 0xa5, 0x22, len];
  entries.forEach((e, i) => {
    if (e.length !== 4 || !e.every(isByte)) throw new RangeError(`entrada de botón ${i + 1} inválida`);
    e.forEach((b, j) => (f[9 + i * 4 + j] = b));
  });
  return f;
};

cmd.resetButtons = () => cmd.writeButtons(FACTORY_BUTTONS, 0x20);

// Confirmación que cierra la escritura de macros: 55 10 a5 22 00 00 00 05.
cmd.confirm = () => {
  const f = blank();
  [f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8]] = [MAGIC, 0x10, 0xa5, 0x22, 0, 0, 0, 5];
  return f;
};

// Entradas de botón (4 bytes).
export const button = {
  mouse: (mask) => [0x20, mask, 0, 0], // 1 izq, 2 der, 4 central, 8 atrás, 0x10 adelante, 0 = deshabilitado
  wheel: (dir) => [0x21, 0x38, dir > 0 ? 1 : 0xff, 0], // rueda arriba (+1) / abajo (-1)
  dpiLoop: () => [0x21, 0x55, 0, 0], // ciclo de DPI (la codificación que usa el reset)
  keyboard: (modifiers, usage) => [0x10, modifiers, usage, 0], // modifiers: Ctrl 1, Shift 2, Alt 4, Win 8 (derechos << 4)
  media: (usage) => [0x30, lo(usage), hi(usage), 0], // código "consumer" HID, p. ej. 0xE9 = volumen +
  // loop: 0 = repetir `count` veces, 2 = hasta soltar la tecla, 3 = hasta pulsar otra tecla
  // (confirmado con el código de la web: opciones 516/517/518).
  macro: (index, count = 1, loop = 0) => [0x70, index, count, loop],
};

// Tabla explícita de fábrica (captura 07 y botón "Reset All Keys" de la web).
export const FACTORY_BUTTONS = [
  button.mouse(1), button.mouse(2), button.mouse(4), button.mouse(8), button.mouse(0x10),
  button.dpiLoop(), button.wheel(1), button.wheel(-1),
];

// Bytes de 4 -> acción legible. La inversa es encodeAction.
export function decodeAction([type, c1, c2, c3]) {
  switch (type) {
    case 0x20: return { kind: "mouse", mask: c1 };
    case 0x21:
      if (c1 === 0x38) return { kind: "wheel", dir: c2 === 1 ? 1 : -1 };
      if (c1 === 0x55) return { kind: "dpi" };
      break;
    case 0xf0: if (c1 === 1 && c2 === 1) return { kind: "dpi" }; break; // otra codificación del botón DPI
    case 0x10: return { kind: "keyboard", modifiers: c1, usage: c2 };
    case 0x30: return { kind: "media", usage: toWord(c1, c2) };
    case 0x70: return { kind: "macro", index: c1, count: c2, loop: c3 };
  }
  return { kind: "unknown", bytes: [type, c1, c2, c3] };
}

export function encodeAction(a) {
  switch (a.kind) {
    case "mouse": return button.mouse(a.mask);
    case "wheel": return button.wheel(a.dir);
    case "dpi": return button.dpiLoop();
    case "keyboard": return button.keyboard(a.modifiers, a.usage);
    case "media": return button.media(a.usage);
    case "macro": return button.macro(a.index, a.count, a.loop);
    case "unknown": return [...a.bytes];
  }
  throw new TypeError(`acción desconocida: ${a.kind}`);
}

// Configuración que escribe "Restore Factory Settings" en la web (ver PROTOCOL.md).
export const FACTORY_CONFIG = {
  light_mode: 0,
  report_rate: 3, // 1000 Hz
  dpi_count: 5,
  dpi_index: 1, // nivel 2 = 800 DPI
  dpi: [400, 800, 1200, 1600, 2400, 3200],
  scroll_flag: 0,
  lod_value: 1,
  sensor_flag: 0x35,
  key_respond: 4,
  sleep_light: 10,
  highspeed_mode: 0,
  wakeup_flag: 0,
};

// Las 3 escrituras del reset de fábrica, en orden. No toca las macros.
export function factoryResetFrames() {
  return [cmd.resetButtons(), cmd.writeConfig(FACTORY_CONFIG), cmd.setLightMode(0)];
}

// ---- Macros ----
// Memoria de 4096 bytes: tabla de direcciones u16 LE en [2*i] (macro i) y eventos desde 0x40.
// Cada evento: [delayLo, delayHi, flags, code]. flags: 3 = mouse, 2 = teclado, 0x40 = pulsar,
// 0x80 = último evento de la macro. Disposición tomada de la función de la web que arma el buffer;
// con hardware solo se comprobó la macro 0 (captures/12).
const MACRO_TABLE = 64;
const MAX_MACROS = MACRO_TABLE / 2;

export function encodeMacros(macros) {
  if (macros.length > MAX_MACROS) throw new RangeError(`máximo ${MAX_MACROS} macros`);
  const data = new Array(MACRO_TABLE).fill(0);
  macros.forEach((events, m) => {
    if (!events.length) return;
    data[m * 2] = lo(data.length);
    data[m * 2 + 1] = hi(data.length);
    events.forEach((e, i) => {
      const delay = Math.max(0, Math.min(0xffff, Math.round(e.delay || 0)));
      const flags = (e.device === "mouse" ? 3 : 2) | (e.down ? 0x40 : 0) | (i === events.length - 1 ? 0x80 : 0);
      data.push(lo(delay), hi(delay), flags, e.code & 0xff);
    });
  });
  if (data.length > MACRO_SIZE) throw new RangeError("las macros no caben en 4096 bytes");
  return data;
}

// Eventos: { device: "mouse" | "keyboard", code, down, delay }.
// code = máscara del botón (mouse) o código HID (teclado).
export const encodeMacro = (events) => encodeMacros([events]);

// Inversa de encodeMacros (para pruebas y para importar volcados).
export function decodeMacros(data) {
  const out = [];
  for (let m = 0; m < MAX_MACROS; m++) {
    const addr = toWord(data[m * 2] ?? 0, data[m * 2 + 1] ?? 0);
    const events = [];
    if (addr >= MACRO_TABLE && addr !== 0xffff) {
      for (let p = addr; p + 3 < data.length; p += 4) {
        const flags = data[p + 2];
        events.push({ device: (flags & 3) === 3 ? "mouse" : "keyboard", code: data[p + 3],
          down: !!(flags & 0x40), delay: toWord(data[p], data[p + 1]) });
        if (flags & 0x80) break;
      }
    }
    out.push(events);
  }
  while (out.length && !out[out.length - 1].length) out.pop();
  return out;
}

// ---- Respuestas ----

export function decodeVersion(resp) {
  return [resp[23], resp[24], resp[25]].map((c) => String.fromCharCode(c)).join(".");
}

export function decodeBattery(resp) {
  return { level: resp[8], charging: resp[9] === 1 };
}

export const decodeOnline = (resp) => resp[8] === 2;

// Mensajes no solicitados `aa fa ...` (el mouse los manda solo). Según la web:
// r[8] = 0xD0 -> batería (r[9] %, r[10] carga); si no -> estado (r[9] = nivel DPI desde 1, r[10] = report rate).
export function decodeUnsolicited(resp) {
  if (resp[0] !== 0xaa || resp[1] !== 0xfa) return null;
  if (resp[8] === 0xd0) {
    const level = resp[9];
    if (Number.isInteger(level) && level >= 0 && level <= 100) {
      return { type: "battery", level, charging: resp[10] === 1 };
    }
    return null;
  }
  const dpi_index = resp[9] - 1;
  const report_rate = resp[10] - 1;
  if (dpi_index >= 0 && dpi_index < 6 && report_rate >= 0 && report_rate <= 3) {
    return { type: "status", dpi_index, report_rate };
  }
  return null;
}
