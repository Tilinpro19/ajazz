// Mouse simulado que habla el mismo protocolo (para probar la UI sin hardware).
// Se activa abriendo la app con #demo. Guarda los cambios solo en memoria.
import { cmd, responseChecksum, FACTORY_CONFIG, FACTORY_BUTTONS, decodeConfig } from "../protocol.js";

function reply(command, data, { len = data.length, extra = {} } = {}) {
  const r = new Uint8Array(64);
  r[0] = 0xaa; r[1] = command; r[2] = 0xa5; r[4] = len;
  data.forEach((b, i) => (r[8 + i] = b));
  for (const [i, v] of Object.entries(extra)) r[i] = v;
  r[3] = responseChecksum(r);
  return r;
}

class DemoDevice extends EventTarget {
  constructor() {
    super();
    this.vendorId = 43172;
    this.productId = 8789;
    this.productName = "AJ139 V2 MC (demo)";
    this.collections = [{ usagePage: 65281, usage: 16 }];
    this.opened = false;
    // Estado en el formato de los frames de escritura.
    this.configFrame = cmd.writeConfig({ ...FACTORY_CONFIG, light_mode: 0 });
    this.buttons = FACTORY_BUTTONS.flat();
  }
  async open() { this.opened = true; }
  async close() { this.opened = false; }
  async sendReport(_id, p) {
    const c = p[1];
    let r;
    if (c === 0x03) r = reply(3, [..."YJX.co.mouse"].map((ch) => ch.charCodeAt(0)).concat([0, 0, 0, 0x32, 0x32, 0x30]), { len: 56 });
    else if (c === 0x30) r = reply(0x30, [76, 0], { len: 10 });
    else if (c === 0x0e) {
      const data = this.configFrame.slice(9, 56); // f[9..55] = r[8..54]
      data[46] = 76; // r[54] = batería
      r = reply(0x0e, data.slice(0, 47), { extra: { 55: this.configFrame[55] } });
    } else if (c === 0x08) r = reply(8, this.buttons);
    else if (c === 0x0f) { this.configFrame = [0, ...p]; r = reply(c, [...p.slice(8, 55)], { len: p[4] }); }
    else if (c === 0x09) { this.buttons = [...p.slice(8, 40)]; r = reply(c, [...p.slice(8, 40)], { len: p[4] }); }
    else if (c === 0x21) {
      const cfg = decodeConfig(reply(0, this.configFrame.slice(9, 56)));
      this.configFrame = cmd.writeConfig({ ...cfg, light_mode: p[10], wakeup_flag: this.configFrame[55] });
      r = reply(c, [0, 0, p[10]], { len: 3 });
    } else r = reply(c, [], { len: 0 });
    setTimeout(() => {
      const e = new Event("inputreport");
      e.reportId = 0;
      e.data = new DataView(r.buffer);
      this.dispatchEvent(e);
    }, 15);
  }
}

export class DemoHid extends EventTarget {
  constructor() {
    super();
    this.device = new DemoDevice();
  }
  async getDevices() { return [this.device]; }
  async requestDevice() { return [this.device]; }
}
