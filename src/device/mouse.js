// API del AJ139 V2 MC sobre un HidTransport. Toda escritura se valida antes de enviarse.
import {
  cmd, decodeConfig, decodeButtons, decodeVersion, decodeBattery, decodeOnline, validateConfig,
  encodeAction, encodeMacros, macroWriteFrames, factoryResetFrames,
} from "../protocol.js";

export const SUPPORTED_FIRMWARE = "2.2.0";

export class Mouse {
  constructor(transport, { mode = "USB", name = "AJ139 V2 MC" } = {}) {
    this.transport = transport;
    this.mode = mode;
    this.name = name;
  }

  #read(frame) {
    return this.transport.request(frame, { validate: true });
  }

  #write(frame) {
    return this.transport.request(frame);
  }

  async version() {
    return decodeVersion(await this.#read(cmd.version()));
  }

  // Por el dongle, r[3] de la batería es un eco de la petición (0x0b), no un checksum:
  // solo se exige el eco del comando.
  async battery() {
    return decodeBattery(await this.transport.request(cmd.battery()));
  }

  // Solo tiene sentido con el dongle 2.4G (por cable siempre responde 0).
  async online() {
    if (this.mode === "USB") return true;
    return decodeOnline(await this.#read(cmd.online()));
  }

  async readConfig() {
    return decodeConfig(await this.#read(cmd.readConfig()));
  }

  // `c` debe ser la configuración leída con solo el campo editado cambiado (regla del HANDOFF).
  async writeConfig(c) {
    const errors = validateConfig(c);
    if (errors.length) throw new RangeError(`configuración inválida: ${errors.join("; ")}`);
    await this.#write(cmd.writeConfig(c));
  }

  // Devuelve [{ bytes, factory, action }] x 8.
  async readButtons() {
    return decodeButtons(await this.#read(cmd.readButtons()));
  }

  // Recibe las 8 acciones (formato de decodeAction). Siempre se escriben juntas.
  async writeButtons(actions) {
    if (actions.length !== 8) throw new RangeError("se necesitan 8 acciones");
    await this.#write(cmd.writeButtons(actions.map(encodeAction)));
  }

  async resetButtons() {
    await this.#write(cmd.resetButtons());
  }

  // `macros`: lista de listas de eventos; el índice es el que usa la acción de botón.
  async writeMacros(macros) {
    for (const frame of macroWriteFrames(encodeMacros(macros))) await this.#write(frame);
  }

  async setLightMode(mode) {
    if (!Number.isInteger(mode) || mode < 0 || mode > 6) throw new RangeError("modo de luz fuera de rango");
    await this.#write(cmd.setLightMode(mode));
  }

  // Botones de fábrica + configuración de fábrica + luz 0. No toca las macros.
  async factoryReset() {
    for (const frame of factoryResetFrames()) await this.#write(frame);
  }
}
