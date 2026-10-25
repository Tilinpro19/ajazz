import { useState } from "react";
import { useController } from "./useController.js";
import { Icon, Battery, Toasts, ActionButton } from "./components.jsx";
import { inElectron } from "./api.js";
import { useIconHover } from "@animateicons/react";
import {
  Gauge,
  Mouse,
  Keyboard,
  Sparkles,
  Settings as SettingsIcon,
  Users,
  RefreshCw,
} from "@animateicons/react/lucide";
import Performance from "./tabs/Performance.jsx";
import Buttons from "./tabs/Buttons.jsx";
import Macros from "./tabs/Macros.jsx";
import Lighting from "./tabs/Lighting.jsx";
import Settings from "./tabs/Settings.jsx";
import Profiles from "./tabs/Profiles.jsx";

const TABS = [
  { id: "performance", label: "Rendimiento", iconComponent: Gauge, view: Performance, needsMouse: true },
  { id: "buttons", label: "Botones", iconComponent: Mouse, view: Buttons, needsMouse: true },
  { id: "macros", label: "Macros", iconComponent: Keyboard, view: Macros, needsMouse: false },
  { id: "lighting", label: "Iluminación", iconComponent: Sparkles, view: Lighting, needsMouse: true },
  { id: "settings", label: "Ajustes", iconComponent: SettingsIcon, view: Settings, needsMouse: true },
  { id: "profiles", label: "Perfiles", iconComponent: Users, view: Profiles, needsMouse: false },
];

function NavTabButton({ tab, active, onSelect }) {
  const { ref, triggerProps } = useIconHover({ trigger: "both" });
  const IconComponent = tab.iconComponent;

  return (
    <button
      type="button"
      className={`nav ${active ? "active" : ""}`}
      {...triggerProps}
      onClick={(e) => {
        triggerProps.onClick?.(e);
        onSelect(e);
      }}
    >
      <IconComponent ref={ref} size={18} />
      <span>{tab.label}</span>
    </button>
  );
}

function Header({ ctl }) {
  const { conn, info, store } = ctl;
  const connected = conn.status === "connected";
  const isOnline = connected && (conn.mode === "USB" || info?.online === true);
  const isSleeping = connected && conn.mode !== "USB" && info?.online === false;
  const status = !connected
    ? "Desconectado"
    : isSleeping
    ? "En reposo / Desconectado"
    : info?.firmware
    ? "Conectado"
    : "Leyendo…";

  return (
    <header className="topbar">
      <div className="device">
        <div className="device-art" aria-hidden="true" title="AJAZZ AJ139 V2 MC">
          <Icon name="mouse" size={24} />
        </div>
        <div>
          <div className="device-name">{info?.name || "AJ139 V2 MC"}</div>
          <div className="device-meta">
            <span className={`dot ${isOnline ? "on" : ""}`} />
            <span>{status}</span>
            {connected && (
              <span className="pill">
                <Icon name={conn.mode === "USB" ? "usb" : "wireless"} size={13} />
                {conn.mode === "USB" ? "Cable USB" : "Dongle 2.4G"}
              </span>
            )}
            {info?.firmware && <span className="pill">Firmware {info.firmware}</span>}
          </div>
        </div>
      </div>
      <div className="topbar-right">
        {isOnline && info?.battery && <Battery level={info.battery.level} charging={info.battery.charging} />}
        {store && (
          <label className="profile-picker">
            <span>Perfil</span>
            <select
              className="select"
              value={store.activeProfileId}
              disabled={ctl.busy}
              onChange={(e) => ctl.switchProfile(e.target.value)}
            >
              {store.profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        )}
        <div className="topbar-spinner-slot">
          {ctl.busy && <span className="spinner" title="Comunicando con el mouse" />}
        </div>
      </div>
    </header>
  );
}

function Waiting({ ctl }) {
  const { conn, info } = ctl;
  if (conn.status === "connected" && info?.online === false) {
    return (
      <div className="empty">
        <div className="empty-icon-wrap">
          <Icon name="wireless" size={38} />
        </div>
        <h2>El dongle está conectado, pero el mouse no responde</h2>
        <p>Enciende el mouse o muévelo para despertarlo. La app lo detectará sola.</p>
      </div>
    );
  }
  if (conn.status === "connected") {
    return (
      <div className="empty">
        <span className="spinner big" />
        <h2>Leyendo la configuración del mouse…</h2>
      </div>
    );
  }
  return (
    <div className="empty">
      <div className="empty-icon-wrap">
        <Icon name="usb" size={38} />
      </div>
      <h2>{conn.status === "error" ? "No se pudo abrir el mouse" : "Buscando el AJ139 V2 MC…"}</h2>
      {conn.error && <p className="error-text">{conn.error.message}</p>}
      <ul className="tips">
        <li>Conecta el mouse con el cable USB o enchufa el dongle 2.4G.</li>
        <li>Cierra la web oficial y otras apps del mouse: solo una puede usarlo a la vez.</li>
        {!inElectron && <li>En el navegador hay que dar permiso con el botón de abajo.</li>}
      </ul>
      <ActionButton icon={RefreshCw} className="btn primary" onClick={ctl.requestDevice}>
        Buscar el mouse
      </ActionButton>
    </div>
  );
}

export default function App() {
  const ctl = useController();
  const [tab, setTab] = useState("performance");
  const current = TABS.find((t) => t.id === tab);
  const ready = Boolean(ctl.config && ctl.buttons);
  const View = current.view;

  return (
    <div className="app">
      <Header ctl={ctl} />
      <div className="body">
        <nav className="sidebar">
          {TABS.map((t) => (
            <NavTabButton
              key={t.id}
              tab={t}
              active={t.id === tab}
              onSelect={() => setTab(t.id)}
            />
          ))}
          <div className="sidebar-foot">
            <Icon name="shield" size={13} />
            <span>Sin red · sin telemetría</span>
          </div>
        </nav>
        <main className="content">
          {current.needsMouse && !ready ? <Waiting ctl={ctl} /> : <View ctl={ctl} />}
        </main>
      </div>
      <Toasts items={ctl.toasts} />
    </div>
  );
}
