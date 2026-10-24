import { useEffect, useState } from "react";
import { Section, Segmented, NumberInput, Field, Toggle } from "../components.jsx";
import { REPORT_RATES, LOD_OPTIONS, SENSOR_BITS } from "../../catalog.js";

const DPI_MIN = 50;
const DPI_MAX = 24000;
const DPI_STEP = 50;
const LEVEL_COLORS = ["#ff4d4d", "#3ddc84", "#4d8dff", "#2fd9d9", "#ffd23f", "#b36bff"];

function DpiLevel({ index, value, enabled, active, onSelect, onCommit }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className={`dpi-level ${active ? "active" : ""} ${enabled ? "" : "disabled"}`} style={{ "--level": LEVEL_COLORS[index] }}>
      <button className="dpi-select" disabled={!enabled} onClick={onSelect} title={enabled ? "Usar este nivel" : "Nivel desactivado"}>
        <span className="dpi-dot" />
        <span>Nivel {index + 1}</span>
        {active && <span className="badge">Activo</span>}
      </button>
      <div className="dpi-value">
        <NumberInput value={value} min={DPI_MIN} max={DPI_MAX} step={DPI_STEP} disabled={!enabled} onCommit={onCommit} />
        <span className="unit">DPI</span>
      </div>
      <input
        type="range"
        className="slider"
        min={DPI_MIN}
        max={DPI_MAX}
        step={DPI_STEP}
        value={draft}
        disabled={!enabled}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={() => draft !== value && onCommit(draft)}
        onKeyUp={() => draft !== value && onCommit(draft)}
      />
    </div>
  );
}

export default function Performance({ ctl }) {
  const { config, info } = ctl;
  const usb = info?.mode === "USB";

  const setDpi = (i, v) => {
    const dpi = [...config.dpi];
    dpi[i] = v;
    ctl.applyConfig({ dpi });
  };

  const setCount = (count) => ctl.applyConfig({ dpi_count: count, dpi_index: Math.min(config.dpi_index, count - 1) });

  const toggleSensor = (bit, on) => ctl.applyConfig({ sensor_flag: on ? config.sensor_flag | bit : config.sensor_flag & ~bit });

  return (
    <>
      <Section
        title="Sensibilidad (DPI)"
        hint="El botón DPI del mouse recorre los niveles activos. Haz clic en un nivel para usarlo ahora."
        actions={
          <Field label="Niveles activos">
            <Segmented options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} value={config.dpi_count} onChange={setCount} />
          </Field>
        }
      >
        <div className="dpi-grid">
          {config.dpi.map((v, i) => (
            <DpiLevel
              key={i}
              index={i}
              value={v}
              enabled={i < config.dpi_count}
              active={i === config.dpi_index}
              onSelect={() => ctl.applyConfig({ dpi_index: i })}
              onCommit={(nv) => setDpi(i, nv)}
            />
          ))}
        </div>
      </Section>

      <Section title="Tasa de reporte" hint={usb ? "Por cable el mouse siempre trabaja a 1000 Hz (igual que en la web oficial)." : "Con qué frecuencia el mouse envía su posición al PC."}>
        <Segmented
          options={REPORT_RATES.map((r) => ({ value: r.value, label: `${r.hz} Hz`, disabled: usb && r.value !== 3 }))}
          value={usb ? 3 : config.report_rate}
          onChange={(v) => ctl.applyConfig({ report_rate: v })}
        />
      </Section>

      <div className="two-col">
        <Section title="Altura de despegue (LOD)" hint="Distancia a la que el sensor deja de leer al levantar el mouse.">
          <Segmented options={LOD_OPTIONS} value={config.lod_value} onChange={(v) => ctl.applyConfig({ lod_value: v })} />
          {!LOD_OPTIONS.some((o) => o.value === config.lod_value) && <p className="hint">Valor actual sin configurar (0x{config.lod_value.toString(16)}).</p>}
        </Section>

        <Section title="Rendimiento del sensor">
          {SENSOR_BITS.map((s) => (
            <Toggle key={s.bit} label={s.label} hint={s.hint} checked={(config.sensor_flag & s.bit) !== 0} onChange={(on) => toggleSensor(s.bit, on)} />
          ))}
        </Section>
      </div>
    </>
  );
}
