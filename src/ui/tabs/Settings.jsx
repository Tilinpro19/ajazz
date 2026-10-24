import { useState } from "react";
import { Section, Segmented, Toggle, Field, NumberInput, ConfirmModal, Icon } from "../components.jsx";
import { SLEEP_MINUTES } from "../../catalog.js";
import { api } from "../api.js";

export default function Settings({ ctl }) {
  const { config, info } = ctl;
  const [confirm, setConfirm] = useState(false);
  const sleepOptions = SLEEP_MINUTES.includes(config.sleep_light) ? SLEEP_MINUTES : [...SLEEP_MINUTES, config.sleep_light].sort((a, b) => a - b);

  return (
    <>
      <Section title="Energía" icon="bolt">
        <Field label="Suspender tras" hint="Tiempo de inactividad antes de que el mouse entre en modo de bajo consumo para ahorrar batería.">
          <select className="select" value={config.sleep_light} onChange={(e) => ctl.applyConfig({ sleep_light: Number(e.target.value) })}>
            {sleepOptions.map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </Field>
        <Toggle
          label="Despertar al mover"
          hint="Si se desactiva, hay que pulsar un botón para reactivar el mouse desde reposo."
          checked={config.wakeup_flag === 0}
          onChange={(on) => ctl.applyConfig({ wakeup_flag: on ? 0 : 1 })}
        />
      </Section>

      <Section title="Rueda de desplazamiento" icon="mouse">
        <Field label="Dirección del desplazamiento" hint="Invierte el sentido del scroll en la rueda si lo prefieres estilo natural.">
          <Segmented
            options={[{ value: 0, label: "Normal" }, { value: 1, label: "Invertida" }]}
            value={config.scroll_flag}
            onChange={(v) => ctl.applyConfig({ scroll_flag: v })}
          />
        </Field>
      </Section>

      <Section title="Ajustes avanzados del hardware" icon="cpu" hint="Ajustes de latencia física y sondeo del microcontrolador.">
        <Field label="Tiempo de respuesta (Debounce)" hint="Tiempo de filtrado anti-rebote en ms (valor de fábrica: 4 ms). Menor tiempo = menor latencia de clic.">
          <div className="row">
            <NumberInput value={config.key_respond} min={0} max={255} className="short" onCommit={(n) => ctl.applyConfig({ key_respond: n })} />
            <span className="unit">ms</span>
          </div>
        </Field>
        <Field label="Modo de alta velocidad" hint={config.highspeed_mode === 0xff ? "Sin configurar (valor de fábrica del mouse)." : "Optimiza la tasa de procesamiento interna del mouse."}>
          <Segmented
            options={[{ value: 0, label: "Desactivado" }, { value: 1, label: "Activado" }]}
            value={config.highspeed_mode === 0xff ? 0 : config.highspeed_mode}
            onChange={(v) => ctl.applyConfig({ highspeed_mode: v })}
          />
        </Field>
      </Section>

      <Section title="Respaldo y valores de fábrica" icon="shield">
        <p className="hint">
          Al conectar el mouse por primera vez la app guardó un respaldo seguro de su configuración y botones
          {ctl.backup?.path ? <> en <code>{ctl.backup.path}</code></> : null}.
        </p>
        <div className="row wrap">
          <button className="btn ghost" onClick={() => api.openBackups()}>
            <Icon name="copy" size={14} /> Abrir carpeta de respaldos
          </button>
          <button className="btn danger" onClick={() => setConfirm(true)}>
            <Icon name="refresh" size={14} /> Restaurar valores de fábrica
          </button>
        </div>
      </Section>

      <Section title="Información del dispositivo" icon="settings">
        <div className="two-col">
          <div className="stack">
            <Field label="Modelo"><strong>{info?.name || "AJAZZ AJ139 V2 MC"}</strong></Field>
            <Field label="Firmware"><code>{info?.firmware ? `v${info.firmware}` : "2.2.0"}</code></Field>
          </div>
          <div className="stack">
            <Field label="Conexión"><span>{info?.mode === "USB" ? "Cable USB directo" : "Receptor Dongle 2.4G"}</span></Field>
            <Field label="Sensor"><span>PixArt PAW3395 (hasta 26.000 DPI)</span></Field>
          </div>
        </div>
      </Section>

      {confirm && (
        <ConfirmModal title="Restaurar valores de fábrica" danger confirm="Restaurar" onConfirm={ctl.factoryReset} onClose={() => setConfirm(false)}>
          <p>Se restauran los botones originales, el DPI (400/800/1200/1600/2400, nivel 800), 1000 Hz, la iluminación y los ajustes, igual que el botón de la web oficial.</p>
          <p>Las macros guardadas en la app no se borran.</p>
        </ConfirmModal>
      )}
    </>
  );
}
