import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useController } from "./useController.js";
import { Icon, Battery, Toasts, ActionButton } from "./components.jsx";
import { inElectron, windowControls } from "./api.js";
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

const LEAVE_MS = 120;

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
    <header className="topbar" data-tauri-drag-region>
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
        <h2>Leyendo la configuración del mouse…</h2>
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
        <li>Cierra el software o la web del fabricante: solo una aplicación puede usar el mouse a la vez.</li>
        {!inElectron && <li>Pulsa el botón de abajo y concede el permiso WebHID.</li>}
      </ul>
      <ActionButton icon={RefreshCw} className="btn primary" onClick={ctl.requestDevice}>
        Detectar dispositivo
      </ActionButton>
    </div>
  );
}

export default function App() {
  const ctl = useController();
  // `target` mueve la barra lateral al instante; `tab` es la vista montada y se
  // cambia tras la animación de salida.
  const [target, setTarget] = useState("performance");
  const [tab, setTab] = useState("performance");
  const [dir, setDir] = useState(1);
  const [leaving, setLeaving] = useState(false);
  const navRef = useRef(null);
  const [marker, setMarker] = useState(null);
  const timer = useRef(0);
  const current = TABS.find((t) => t.id === tab);
  const ready = Boolean(ctl.config && ctl.buttons);
  const View = current.view;

  useEffect(() => () => clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    const el = navRef.current?.querySelector(".nav.active");
    if (el) setMarker({ top: el.offsetTop, height: el.offsetHeight });
  }, [target]);

  const select = (id) => {
    if (id === target) return;
    const order = (x) => TABS.findIndex((t) => t.id === x);
    setDir(order(id) > order(target) ? 1 : -1);
    setTarget(id);
    setLeaving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setTab(id);
      setLeaving(false);
    }, LEAVE_MS);
  };

  return (
    <div className="app">
      <Header ctl={ctl} />
      <div className="body">
        <aside className="sidebar">
          <nav className="sidebar-nav" ref={navRef}>
            {marker && (
              <span
                className="nav-marker"
                style={{ transform: `translateY(${marker.top}px)`, height: marker.height }}
              />
            )}
            {TABS.map((t) => (
              <NavTabButton
                key={t.id}
                tab={t}
                active={t.id === target}
                onSelect={() => select(t.id)}
              />
            ))}
          </nav>
        </aside>
        <main className="content">
          <div className="content-container">
            <div key={tab} className={`tab-view ${leaving ? "leaving" : ""}`} data-dir={dir}>
              {current.needsMouse && !ready ? <Waiting ctl={ctl} /> : <View ctl={ctl} />}
            </div>
          </div>
        </main>
      </div>
      <Toasts items={ctl.toasts} />
      {windowControls && <WindowControls />}
    </div>
  );
}

// Botones de ventana propios (Tauri sin marco).
function WindowControls() {
  return (
    <div className="win-controls">
      <button aria-label="Minimizar" onClick={windowControls.minimize}>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" /></svg>
      </button>
      <button aria-label="Maximizar" onClick={windowControls.toggleMaximize}>
        <svg width="10" height="10" viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" fill="none" stroke="currentColor" /></svg>
      </button>
      <button aria-label="Cerrar" className="close" onClick={windowControls.close}>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" /></svg>
      </button>
    </div>
  );
}
