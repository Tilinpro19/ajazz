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
export function decodeButtons(resp) {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const o = 8 + i * 4;
    out.push({ type: resp[o], code1: resp[o + 1], code2: resp[o + 2], code3: resp[o + 3] });
  }
  return out;
}

// Valida el objeto de configuración antes de enviarlo al mouse.
export function validateConfig(c) {
  const errors = [];
  if (!Array.isArray(c.dpi) || c.dpi.length !== 6) errors.push("dpi debe tener 6 valores");
  if (c.dpi_count < 1 || c.dpi_count > 6) errors.push("dpi_count debe estar entre 1 y 6");
  if (c.dpi_index < 0 || c.dpi_index >= c.dpi_count) errors.push("dpi_index fuera de rango");
  if (c.report_rate < 0 || c.report_rate > 7) errors.push("report_rate fuera de rango");
  for (const v of c.dpi || []) {
    if (!Number.isInteger(v) || v < 50 || v > 26000) errors.push(`DPI inválido: ${v}`);
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
// Confirmado contra el sendReport real de la web (captures/12 y 13).
cmd.writeButtons = (entries) => {
  if (entries.length !== 8) throw new RangeError("se necesitan 8 entradas de botón");
  const f = blank();
  [f[1], f[2], f[3], f[4], f[5]] = [MAGIC, 0x09, 0xa5, 0x22, 0x31];
  entries.forEach((e, i) => e.forEach((b, j) => (f[9 + i * 4 + j] = b)));
  return f;
};

// Entradas de botón (4 bytes). Los tipos 0x20/0x21 ya los decodifica decodeButtons.
export const button = {
  mouse: (mask) => [0x20, mask, 0, 0], // 1 izq, 2 der, 4 central, 8 atrás, 0x10 adelante, 0 = deshabilitado
  keyboard: (modifiers, usage) => [0x10, modifiers, usage, 0], // modifiers: Ctrl 1, Shift 2, Alt 4, Win 8
  // loop: 0 = repetir `count` veces, 2 = hasta soltar la tecla, 3 = hasta pulsar otra (2 y 3 por orden, sin confirmar)
  macro: (index, count = 1, loop = 0) => [0x70, index, count, loop],
};

// Eventos de macro: { device: "mouse" | "keyboard", code, down, delay }.
// code = máscara del botón (mouse) o código HID (teclado).
export function encodeMacro(events) {
  const data = new Array(64).fill(0);
  data[0] = 0x40; // dirección de inicio de la macro 0 (little endian: 40 00)
  events.forEach((e, i) => {
    const flags = (e.device === "mouse" ? 3 : 2) | (e.down ? 0x40 : 0) | (i === events.length - 1 ? 0x80 : 0);
    data.push(lo(e.delay), hi(e.delay), flags, e.code);
  });
  return data;
}
