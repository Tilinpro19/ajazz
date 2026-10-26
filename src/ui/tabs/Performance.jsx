import { useEffect, useState } from "react";
import { Section, Segmented, NumberInput, Toggle } from "../components.jsx";
import { REPORT_RATES, LOD_OPTIONS, SENSOR_BITS } from "../../catalog.js";

const DPI_MIN = 50;
const DPI_MAX = 24000;
const DPI_STEP = 50;
const LEVEL_COLORS = ["#ff4d4d", "#00f5a0", "#00d2ff", "#2fd9d9", "#ffd23f", "#b36bff"];
const QUICK_PRESETS = [400, 800, 1200, 1600, 2400, 3200, 6400];
const TICKS = [800, 1600, 3200, 6400, 12800, 24000];

// Escala cuadrática: da más resolución al rango habitual (400–3200 DPI).
const toPct = (dpi) => Math.sqrt((dpi - DPI_MIN) / (DPI_MAX - DPI_MIN)) * 100;
const fromPct = (pct) => {
  const raw = DPI_MIN + (DPI_MAX - DPI_MIN) * (pct / 100) ** 2;
  return Math.min(DPI_MAX, Math.max(DPI_MIN, Math.round(raw / DPI_STEP) * DPI_STEP));
};
const clampDpi = (n) => Math.min(DPI_MAX, Math.max(DPI_MIN, n));

export default function Performance({ ctl }) {
  const { config, info } = ctl;
  const usb = info?.mode === "USB";

  const activeIndex = config.dpi_index;
  const activeDpi = config.dpi[activeIndex] || 1600;

  const [draft, setDraft] = useState(activeDpi);
  useEffect(() => {
    setDraft(activeDpi);
  }, [activeDpi, activeIndex]);

  const setDpi = (index, value) => {
    const dpi = [...config.dpi];
    dpi[index] = value;
    ctl.applyConfig({ dpi });
  };
  const commitDraft = () => draft !== activeDpi && setDpi(activeIndex, draft);

  const setCount = (count) => {
    ctl.applyConfig({
      dpi_count: count,
      dpi_index: Math.min(config.dpi_index, count - 1),
    });
  };

  const toggleSensor = (bit, on) => {
    ctl.applyConfig({
      sensor_flag: on ? config.sensor_flag | bit : config.sensor_flag & ~bit,
    });
  };

  const onSliderKey = (e) => {
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    setDraft((d) => clampDpi(d + dir * DPI_STEP * (e.shiftKey ? 10 : 1)));
  };

  const pct = toPct(draft);
  const color = LEVEL_COLORS[activeIndex];

  return (
    <div className="tab-layout">
      <div className="dpi-panel" style={{ "--level-color": color }}>
        <div className="dpi-head">
          <h1>Sensibilidad (DPI)</h1>
          <div className="dpi-levels-selector">
            <span className="meta-label">Niveles</span>
            <Segmented
              options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
              value={config.dpi_count}
              onChange={setCount}
            />
          </div>
        </div>

        <div className="dpi-levels" style={{ "--cols": config.dpi_count }}>
          {config.dpi.slice(0, config.dpi_count).map((v, i) => {
            const active = i === activeIndex;
            const shown = active ? draft : v;
            return (
              <button
                key={i}
                type="button"
                className={`dpi-level-card ${active ? "active" : ""}`}
                style={{ "--level-color": LEVEL_COLORS[i] }}
                aria-pressed={active}
                onClick={() => !active && ctl.applyConfig({ dpi_index: i })}
              >
                <span className="dpi-level-name">
                  <span className="dpi-level-dot" />
                  Nivel {i + 1}
                </span>
                <span className="dpi-level-value">{shown}</span>
                <span className="dpi-level-bar">
                  <span style={{ width: `${toPct(shown)}%` }} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="dpi-editor">
          <div className="dpi-editor-top">
            <div className="dpi-readout">
              <span className="dpi-readout-label">Editando nivel {activeIndex + 1}</span>
              <div className="dpi-readout-row">
                <NumberInput
                  value={draft}
                  min={DPI_MIN}
                  max={DPI_MAX}
                  step={DPI_STEP}
                  className="dpi-big-input"
                  onCommit={(n) => {
                    setDraft(n);
                    setDpi(activeIndex, n);
                  }}
                />
                <span className="dpi-big-unit">DPI</span>
              </div>
            </div>
            <div className="dpi-preset-chips">
              {QUICK_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`quick-chip ${activeDpi === p ? "active" : ""}`}
                  onClick={() => setDpi(activeIndex, p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="dpi-slider-wrap">
            <input
              type="range"
              className="dpi-slider"
              aria-label={`DPI del nivel ${activeIndex + 1}`}
              min={0}
              max={100}
              step={0.1}
              value={pct}
              style={{ "--pct": `${pct}%` }}
              onChange={(e) => setDraft(fromPct(Number(e.target.value)))}
              onKeyDown={onSliderKey}
              onPointerUp={commitDraft}
              onKeyUp={commitDraft}
            />
            <div className="dpi-ticks" aria-hidden="true">
              {TICKS.map((t) => (
                <span key={t} style={{ left: `${toPct(t)}%` }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bento-grid">
        <Section
          title="Tasa de sondeo"
          hint={usb ? "Por cable USB el mouse trabaja siempre a 1000 Hz." : "Cuántas veces por segundo el mouse reporta su posición al PC."}
        >
          <Segmented
            options={REPORT_RATES.map((r) => {
              const ms = r.hz === 1000 ? "1 ms" : r.hz === 500 ? "2 ms" : r.hz === 250 ? "4 ms" : "8 ms";
              return {
                value: r.value,
                label: `${r.hz} Hz (${ms})`,
                disabled: usb && r.value !== 3,
              };
            })}
            value={usb ? 3 : config.report_rate}
            onChange={(v) => ctl.applyConfig({ report_rate: v })}
          />
        </Section>

        <div className="bento-columns">
          <Section
            title="Distancia de despegue (LOD)"
            hint="Altura a la que el sensor deja de registrar al levantar el mouse."
          >
            <Segmented
              options={LOD_OPTIONS.map((o) => ({
                ...o,
                label: o.value === 1 ? "Baja (1 mm)" : "Alta (2 mm)",
              }))}
              value={config.lod_value}
              onChange={(v) => ctl.applyConfig({ lod_value: v })}
            />
          </Section>

          <Section title="Sensor">
            <div className="toggle-group">
              {SENSOR_BITS.map((s) => (
                <Toggle
                  key={s.bit}
                  label={s.label}
                  hint={s.hint}
                  checked={(config.sensor_flag & s.bit) !== 0}
                  onChange={(on) => toggleSensor(s.bit, on)}
                />
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
