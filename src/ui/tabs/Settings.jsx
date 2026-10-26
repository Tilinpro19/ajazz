import { useEffect, useState } from "react";
import { Section, Segmented, Toggle, Field, NumberInput, ConfirmModal, Icon, CircularBatteryGauge } from "../components.jsx";
import { SLEEP_MINUTES } from "../../catalog.js";
import { api, inElectron } from "../api.js";

export default function Settings({ ctl }) {
  const { config, info } = ctl;
  const [confirm, setConfirm] = useState(false);
  const [appSettings, setAppSettings] = useState(null);
  useEffect(() => {
    api.getAppSettings().then(setAppSettings);
  }, []);
  const changeApp = (patch) => api.setAppSettings(patch).then(setAppSettings);
  const sleepOptions = SLEEP_MINUTES.includes(config.sleep_light)
    ? SLEEP_MINUTES
    : [...SLEEP_MINUTES, config.sleep_light].sort((a, b) => a - b);

  return (
    <div className="tab-layout">
      {/* Battery & Power Telemetry */}
      <Section title="Energía">
        <div className="settings-power-grid">
          {info?.battery && (
            <CircularBatteryGauge level={info.battery.level} charging={info.battery.charging} />
          )}
          <div className="settings-power-controls">
            <Field
              label="Reposo tras inactividad"
            >
              <select
                className="select"
                value={config.sleep_light}
                onChange={(e) => ctl.applyConfig({ sleep_light: Number(e.target.value) })}
              >
                {sleepOptions.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </Field>

            <Toggle
              label="Reactivar al mover el mouse"
              hint="Si se desactiva, solo un clic despierta el mouse."
              checked={config.wakeup_flag === 0}
              onChange={(on) => ctl.applyConfig({ wakeup_flag: on ? 0 : 1 })}
            />
          </div>
        </div>
      </Section>

      {/* Hardware Performance Controls */}
      <Section title="Comportamiento">
        <div className="bento-columns">
          <Field label="Dirección de la rueda">
            <Segmented
              options={[
                { value: 0, label: "Normal" },
                { value: 1, label: "Invertida" },
              ]}
              value={config.scroll_flag}
              onChange={(v) => ctl.applyConfig({ scroll_flag: v })}
            />
          </Field>

          <Field
            label="Anti-rebote (debounce)"
            hint="Milisegundos que se ignora un botón tras pulsarlo, para evitar dobles clics."
          >
            <div className="debounce-row">
              <NumberInput
                value={config.key_respond}
                min={0}
                max={255}
                className="short"
                onCommit={(n) => ctl.applyConfig({ key_respond: n })}
              />
              <span className="unit-label">ms</span>
            </div>
          </Field>
        </div>

        <div className="pt-2">
          <Field
            label="Modo de alta velocidad"
            hint={config.highspeed_mode === 0xff ? "Sin configurar (valor de fábrica)." : undefined}
          >
            <Segmented
              options={[
                { value: 0, label: "Desactivado" },
                { value: 1, label: "Activado" },
              ]}
              value={config.highspeed_mode === 0xff ? 0 : config.highspeed_mode}
              onChange={(v) => ctl.applyConfig({ highspeed_mode: v })}
            />
          </Field>
        </div>
      </Section>

      {inElectron && appSettings && (
        <Section title="Aplicación">
          <Toggle
            label="Cerrar a la bandeja"
            hint="La X oculta la ventana y la app sigue aplicando perfiles. Para salir, usa el icono de la bandeja."
            checked={appSettings.closeToTray}
            onChange={(on) => changeApp({ closeToTray: on })}
          />
          <Toggle
            label="Iniciar con Windows"
            checked={appSettings.startWithWindows}
            onChange={(on) => changeApp({ startWithWindows: on })}
          />
          <Toggle
            label="Arrancar minimizada en la bandeja"
            hint="Solo al iniciar con Windows."
            checked={appSettings.startMinimized}
            disabled={!appSettings.startWithWindows}
            onChange={(on) => changeApp({ startMinimized: on })}
          />
        </Section>
      )}

      {/* Device Specs and Maintenance */}
      <div className="bento-columns">
        <Section title="Dispositivo">
          <div className="specs-list">
            <div className="spec-row">
              <span className="spec-key">Modelo</span>
              <span className="spec-val">{info?.name || "AJAZZ AJ139 V2 MC"}</span>
            </div>
            <div className="spec-row">
              <span className="spec-key">Firmware</span>
              <span className="spec-val code">{info?.firmware ? `v${info.firmware}` : "—"}</span>
            </div>
            <div className="spec-row">
              <span className="spec-key">Conexión</span>
              <span className="spec-val">{info?.mode === "USB" ? "Cable USB-C" : "Receptor 2.4G"}</span>
            </div>
            <div className="spec-row">
              <span className="spec-key">Sensor</span>
              <span className="spec-val">PixArt PAW3395</span>
            </div>
          </div>
        </Section>

        <Section title="Respaldos y restauración">
          <div className="maintenance-stack">
            <p className="hint">
              Copia local de la configuración del mouse
              {ctl.backup?.path ? <> en <code>{ctl.backup.path}</code></> : null}.
            </p>
            <div className="maintenance-actions">
              <button type="button" className="btn ghost" onClick={() => api.openBackups()}>
                <Icon name="copy" size={14} />
                <span>Abrir carpeta</span>
              </button>
              <button type="button" className="btn danger" onClick={() => setConfirm(true)}>
                <Icon name="refresh" size={14} />
                <span>Valores de fábrica</span>
              </button>
            </div>
          </div>
        </Section>
      </div>

      {confirm && (
        <ConfirmModal
          title="Restablecer valores de fábrica"
          danger
          confirm="Restablecer"
          onConfirm={ctl.factoryReset}
          onClose={() => setConfirm(false)}
        >
          <p>
            Se restablecerán todos los parámetros en el hardware: DPI por defecto (400/800/1200/1600/2400),
            tasa de sondeo a 1000 Hz, iluminación y botones originales.
          </p>
          <p className="hint mt-1">Las macros locales del software no se eliminarán.</p>
        </ConfirmModal>
      )}
    </div>
  );
}
