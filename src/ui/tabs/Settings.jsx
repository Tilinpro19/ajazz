import { useState } from "react";
import { Section, Segmented, Toggle, Field, NumberInput, ConfirmModal } from "../components.jsx";
import { SLEEP_MINUTES } from "../../catalog.js";
import { api } from "../api.js";

export default function Settings({ ctl }) {
  const { config } = ctl;
  const [confirm, setConfirm] = useState(false);
  const sleepOptions = SLEEP_MINUTES.includes(config.sleep_light) ? SLEEP_MINUTES : [...SLEEP_MINUTES, config.sleep_light].sort((a, b) => a - b);

  return (
    <>
      <Section title="Energía">
        <Field label="Suspender tras" hint="Minutos sin uso antes de que el mouse se duerma.">
          <select className="select" value={config.sleep_light} onChange={(e) => ctl.applyConfig({ sleep_light: Number(e.target.value) })}>
            {sleepOptions.map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </Field>
        <Toggle label="Despertar al mover" hint="Si se desactiva, hay que pulsar un botón para despertarlo."
          checked={config.wakeup_flag === 0} onChange={(on) => ctl.applyConfig({ wakeup_flag: on ? 0 : 1 })} />
      </Section>

      <Section title="Rueda">
        <Field label="Dirección del desplazamiento">
          <Segmented options={[{ value: 0, label: "Normal" }, { value: 1, label: "Invertida" }]} value={config.scroll_flag}
            onChange={(v) => ctl.applyConfig({ scroll_flag: v })} />
        </Field>
      </Section>

      <Section title="Avanzado" hint="Estos dos valores no tienen control en la web oficial; su efecto exacto no está confirmado.">
        <Field label="Respuesta de botones" hint="Valor de fábrica: 4. Probablemente el tiempo de rebote en ms.">
          <NumberInput value={config.key_respond} min={0} max={255} className="short" onCommit={(n) => ctl.applyConfig({ key_respond: n })} />
        </Field>
        <Field label="Modo de alta velocidad" hint={config.highspeed_mode === 0xff ? "Sin configurar (valor de fábrica del mouse)." : "Valor de fábrica: desactivado."}>
          <Segmented options={[{ value: 0, label: "Desactivado" }, { value: 1, label: "Activado" }]} value={config.highspeed_mode}
            onChange={(v) => ctl.applyConfig({ highspeed_mode: v })} />
        </Field>
      </Section>

      <Section title="Respaldo y fábrica">
        <p className="hint">
          Al conectar el mouse por primera vez la app guardó un respaldo de su configuración y botones
          {ctl.backup?.path ? <> en <code>{ctl.backup.path}</code></> : null}.
        </p>
        <div className="row">
          <button className="btn ghost" onClick={() => api.openBackups()}>Abrir carpeta de respaldos</button>
          <button className="btn danger" onClick={() => setConfirm(true)}>Restaurar valores de fábrica</button>
        </div>
      </Section>

      {confirm && (
        <ConfirmModal title="Restaurar valores de fábrica" danger confirm="Restaurar" onConfirm={ctl.factoryReset} onClose={() => setConfirm(false)}>
          <p>Se restauran los botones, el DPI (400/800/1200/1600/2400, nivel 800), 1000 Hz, la iluminación y los ajustes, igual que el botón de la web oficial.</p>
          <p>Las macros guardadas no se borran.</p>
        </ConfirmModal>
      )}
    </>
  );
}
