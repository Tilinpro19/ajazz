import { useEffect, useState } from "react";
import { Section, Segmented, NumberInput, Toggle } from "../components.jsx";
import { REPORT_RATES, LOD_OPTIONS, SENSOR_BITS } from "../../catalog.js";

const DPI_MIN = 50;
const DPI_MAX = 24000;
const DPI_STEP = 50;
const LEVEL_COLORS = ["#ff4d4d", "#00f5a0", "#00d2ff", "#2fd9d9", "#ffd23f", "#b36bff"];
const QUICK_PRESETS = [400, 800, 1200, 1600, 2400, 3200, 6400];

export default function Performance({ ctl }) {
  const { config, info } = ctl;
  const usb = info?.mode === "USB";

  const activeIndex = config.dpi_index;
  const activeDpi = config.dpi[activeIndex] || 1600;

  const [scrubberDraft, setScrubberDraft] = useState(activeDpi);
  useEffect(() => {
    setScrubberDraft(activeDpi);
  }, [activeDpi]);

  const setDpi = (index, value) => {
    const dpi = [...config.dpi];
    dpi[index] = value;
    ctl.applyConfig({ dpi });
  };

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

  const activeProgress = Math.min(
    100,
    Math.max(0, (config.dpi_count <= 1 ? 0 : activeIndex / (config.dpi_count - 1)) * 100)
  );

  return (
    <div className="tab-layout">
      {/* Hero DPI Calibration Showcase */}
      <div className="dpi-hero-panel">
        <div className="dpi-hero-top">
          <div className="dpi-hero-meta">
            <span className="section-badge">PIXART PAW3395</span>
            <h1 className="dpi-hero-title">Sensibilidad (DPI)</h1>
            <p className="dpi-hero-subtitle">Calibración óptica en incrementos de 50 DPI.</p>
          </div>
          <div className="dpi-levels-selector">
            <span className="meta-label">Etapas activas</span>
            <Segmented
              options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
              value={config.dpi_count}
              onChange={setCount}
            />
          </div>
        </div>

        {/* Big Telemetry Display */}
        <div className="dpi-hero-center">
          <span className="dpi-stage-tag">NIVEL {activeIndex + 1} ACTIVO</span>
          <div className="dpi-big-number-row">
            <span className="dpi-big-number">{activeDpi}</span>
            <span className="dpi-big-unit">DPI</span>
          </div>

          {/* Quick Presets Bar */}
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

        {/* Stage Node Rail (Stitch G-Hub Style) */}
        <div className="dpi-rail-container">
          <div className="dpi-rail-bg" />
          <div className="dpi-rail-fill" style={{ width: `${activeProgress}%` }} />
          <div className="dpi-nodes-row">
            {config.dpi.slice(0, config.dpi_count).map((v, i) => {
              const isActive = i === activeIndex;
              return (
                <div
                  key={i}
                  className={`dpi-level dpi-node ${isActive ? "active" : ""}`}
                  onClick={() => ctl.applyConfig({ dpi_index: i })}
                  title={`Seleccionar Nivel ${i + 1} (${v} DPI)`}
                >
                  <span className="dpi-node-val">{v}</span>
                  <div className="dpi-node-disc" style={{ "--dot-color": LEVEL_COLORS[i] }}>
                    <span className="dpi-node-core" />
                  </div>
                  <div className="dpi-select">
                    <span>Nivel {i + 1}</span>
                    {isActive && <span className="badge">Activo</span>}
                  </div>
                  <div className="sr-only-input">
                    <NumberInput
                      value={v}
                      min={DPI_MIN}
                      max={DPI_MAX}
                      step={DPI_STEP}
                      onCommit={(nv) => setDpi(i, nv)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fine Scrubber Control */}
        <div className="dpi-scrubber-bar">
          <span className="scrubber-bound">50</span>
          <div className="scrubber-slider-wrap">
            <input
              type="range"
              className="dpi-slider"
              min={DPI_MIN}
              max={DPI_MAX}
              step={DPI_STEP}
              value={scrubberDraft}
              onChange={(e) => setScrubberDraft(Number(e.target.value))}
              onPointerUp={() => scrubberDraft !== activeDpi && setDpi(activeIndex, scrubberDraft)}
              onKeyUp={() => scrubberDraft !== activeDpi && setDpi(activeIndex, scrubberDraft)}
            />
          </div>
          <span className="scrubber-bound">24000</span>
          <div className="scrubber-input-wrap">
            <NumberInput
              value={activeDpi}
              min={DPI_MIN}
              max={DPI_MAX}
              step={DPI_STEP}
              className="short"
              onCommit={(nv) => setDpi(activeIndex, nv)}
            />
            <span className="unit-label">DPI</span>
          </div>
        </div>
      </div>

      {/* Bento Grid: Polling, LOD, Sensor */}
      <div className="bento-grid">
        <Section
          title="Tasa de sondeo"
          badge="TIEMPO DE RESPUESTA"
          hint={usb ? "1000 Hz fijado por hardware bajo conexión USB-C directa." : "Frecuencia de muestreo del sensor hacia el sistema."}
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
            title="Distancia de elevación (LOD)"
            badge="SENSOR LIFT-OFF"
            hint="Corte óptico al levantar el mouse de la superficie."
          >
            <Segmented
              options={LOD_OPTIONS.map((o) => ({
                ...o,
                label: o.value === 1 ? "Baja (1 mm)" : "Alta (2 mm)",
                title: o.value === 1 ? "Modo competitivo FPS" : "Superficies irregulares o tela gruesa",
              }))}
              value={config.lod_value}
              onChange={(v) => ctl.applyConfig({ lod_value: v })}
            />
          </Section>

          <Section
            title="Calibración avanzada"
            badge="PIXART DSP"
            hint="Ajustes de sincronización y estabilización de datos."
          >
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
