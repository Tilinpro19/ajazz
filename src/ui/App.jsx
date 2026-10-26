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
    ? "En reposo"
    : info?.firmware
    ? "En línea"
    : "Sincronizando…";

  return (
    <header className="topbar">
      <div className="topbar-brand-group">
        <div className="brand-logo" title="AJAZZ Control Suite">
          <Icon name="gauge" size={20} />
          <span className="brand-title">HEX SUITE</span>
        </div>
        <div className="topbar-divider" />
        <div className="device-chip">
          <Icon name="mouse" size={15} />
          <span className="device-title">{info?.name || "AJ139 V2 MC"}</span>
          <span className={`status-dot ${isOnline ? "online" : ""}`} title={status} />
          <span className="status-label">{status}</span>
          {connected && (
            <span className="conn-tag">
              <Icon name={conn.mode === "USB" ? "usb" : "wireless"} size={12} />
              {conn.mode === "USB" ? "USB-C" : "2.4G"}
            </span>
          )}
          {info?.firmware && <span className="firmware-tag">v{info.firmware}</span>}
        </div>
      </div>

      <div className="topbar-right">
        {isOnline && info?.battery && (
          <Battery level={info.battery.level} charging={info.battery.charging} />
        )}
        {store && (
          <div className="topbar-profile-slot">
            <span className="topbar-profile-label">Perfil</span>
            <select
              className="select profile-select"
              value={store.activeProfileId}
              disabled={ctl.busy}
              onChange={(e) => ctl.switchProfile(e.target.value)}
            >
              {store.profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
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
          <Icon name="wireless" size={36} />
        </div>
        <h2>Receptor conectado · Mouse en reposo</h2>
        <p>Mueve el mouse o pulsa un botón para reactivar la conexión.</p>
      </div>
    );
  }
  if (conn.status === "connected") {
    return (
      <div className="empty">
        <span className="spinner big" />
        <h2>Sincronizando telemetría de hardware…</h2>
      </div>
    );
  }
  return (
    <div className="empty">
      <div className="empty-icon-wrap">
        <Icon name="usb" size={36} />
      </div>
      <h2>{conn.status === "error" ? "Error de conexión" : "Buscando AJ139 V2 MC"}</h2>
      {conn.error && <p className="error-text">{conn.error.message}</p>}
      <ul className="tips">
        <li>Conecta el mouse por cable USB o inserta el dongle receptor 2.4G.</li>
        <li>Cierra otras utilidades o pestañas web del fabricante para evitar conflicto de interfaz.</li>
        {!inElectron && <li>Concede permisos de acceso WebHID mediante el botón inferior.</li>}
      </ul>
      <ActionButton icon={RefreshCw} className="btn primary" onClick={ctl.requestDevice}>
        Detectar dispositivo
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
        <aside className="sidebar">
          <div className="sidebar-group-title">DISPOSITIVO ACTIVO</div>
          <nav className="sidebar-nav">
            {TABS.map((t) => (
              <NavTabButton
                key={t.id}
                tab={t}
                active={t.id === tab}
                onSelect={() => setTab(t.id)}
              />
            ))}
          </nav>
          <div className="sidebar-foot">
            <span className="telemetry-pill">
              <span className="telemetry-dot" />
              <span>PAW3395 · 1000 Hz</span>
            </span>
          </div>
        </aside>
        <main className="content">
          <div className="content-container">
            {current.needsMouse && !ready ? <Waiting ctl={ctl} /> : <View ctl={ctl} />}
          </div>
        </main>
      </div>
      <Toasts items={ctl.toasts} />
    </div>
  );
}
