import { useState } from "react";
import { Section, Toggle, Field, PromptModal, ConfirmModal, Icon, ActionButton } from "../components.jsx";
import { Plus, Copy } from "@animateicons/react/lucide";
import { inElectron } from "../api.js";

function Rules({ ctl }) {
  const { store, foreground } = ctl;
  const [exe, setExe] = useState("");
  const [profileId, setProfileId] = useState(store.profiles[0].id);
  const rules = store.autoSwitch.rules;

  const add = (name) => {
    const clean = name.trim();
    if (!clean) return;
    const withExe = clean.toLowerCase().endsWith(".exe") ? clean : `${clean}.exe`;
    const others = rules.filter((r) => r.exe.toLowerCase() !== withExe.toLowerCase());
    ctl.setAutoSwitch({ rules: [...others, { exe: withExe, profileId }] });
    setExe("");
  };

  const nameOf = (id) => store.profiles.find((p) => p.id === id)?.name ?? "?";

  return (
    <>
      <Field label="Perfil por defecto" hint="Se aplica cuando la ventana en primer plano no coincide con ninguna regla de la lista.">
        <select className="select" value={store.autoSwitch.defaultProfileId} onChange={(e) => ctl.setAutoSwitch({ defaultProfileId: e.target.value })}>
          {store.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>

      <table className="events">
        <thead>
          <tr><th>Programa ejecutable</th><th>Perfil asignado</th><th /></tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.exe}>
              <td><code>{r.exe}</code></td>
              <td><strong>{nameOf(r.profileId)}</strong></td>
              <td className="row-actions">
                <button className="icon-btn" aria-label="Eliminar regla" title="Eliminar regla" onClick={() => ctl.setAutoSwitch({ rules: rules.filter((x) => x !== r) })}>
                  <Icon name="x" size={14} />
                </button>
              </td>
            </tr>
          ))}
          {!rules.length && <tr><td colSpan={3} className="hint">Sin reglas configuradas todavía. Agrega una abajo con el nombre del juego o programa.</td></tr>}
        </tbody>
      </table>

      <div className="row wrap">
        <input className="text" placeholder="juego.exe" value={exe} onChange={(e) => setExe(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add(exe)} />
        <select className="select" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          {store.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <ActionButton icon={Plus} className="btn ghost" disabled={!exe.trim()} onClick={() => add(exe)}>
          Agregar regla
        </ActionButton>
        {foreground && (
          <button className="btn ghost" onClick={() => add(foreground)} title="Detectado en primer plano">
            Usar {foreground}
          </button>
        )}
      </div>
    </>
  );
}

export default function Profiles({ ctl }) {
  const { store } = ctl;
  const [modal, setModal] = useState(null);
  if (!store) return null;

  return (
    <>
      <Section
        title="Perfiles"
        hint="Un perfil guarda DPI, tasa de reporte, ajustes, iluminación y botones. Al elegirlo se escribe en el mouse."
        icon="profiles"
        actions={<>
          <button className="btn ghost" onClick={ctl.importProfileFile}>
            Importar
          </button>
          <ActionButton icon={Plus} className="btn primary" onClick={() => setModal({ type: "new" })}>
            Nuevo perfil
          </ActionButton>
        </>}
      >
        <ul className="profile-list">
          {store.profiles.map((p) => {
            const active = p.id === store.activeProfileId;
            return (
              <li key={p.id} className={`profile ${active ? "active" : ""}`}>
                <div className="profile-main">
                  <strong>{p.name}</strong>
                  <small className="hint">
                    {p.config.dpi.slice(0, p.config.dpi_count).join(" / ")} DPI · nivel {p.config.dpi_index + 1}
                  </small>
                </div>
                <div className="row">
                  {active ? <span className="badge">Activo</span> : (
                    <button className="btn primary" disabled={!ctl.config && ctl.conn.status === "connected"} onClick={() => ctl.switchProfile(p.id)}>Usar</button>
                  )}
                  <button className="btn ghost" onClick={() => setModal({ type: "rename", profile: p })}>Renombrar</button>
                  <ActionButton icon={Copy} className="btn ghost" title="Duplicar este perfil" onClick={() => ctl.duplicateProfile(p.id)}>Duplicar</ActionButton>
                  <button className="btn ghost" onClick={() => ctl.exportProfileFile(p.id)}>Exportar</button>
                  <button className="btn ghost danger-text" disabled={store.profiles.length === 1} onClick={() => setModal({ type: "delete", profile: p })}>Eliminar</button>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Cambio automático por programa" icon="sparkles" hint={inElectron ? "Cambia de perfil automáticamente según el juego o aplicación en primer plano (solo Windows)." : "Disponible solo en la app de escritorio."}>
        <Toggle label="Activar cambio automático" disabled={!inElectron} checked={store.autoSwitch.enabled} onChange={(enabled) => ctl.setAutoSwitch({ enabled })} />
        {store.autoSwitch.enabled && <Rules ctl={ctl} />}
      </Section>

      {modal?.type === "new" && (
        <PromptModal title="Nuevo perfil" label="Nombre (se crea con la configuración actual del mouse)" initial={`Perfil ${store.profiles.length + 1}`}
          confirm="Crear" onSubmit={ctl.createProfile} onClose={() => setModal(null)} />
      )}
      {modal?.type === "rename" && (
        <PromptModal title="Renombrar perfil" label="Nombre" initial={modal.profile.name}
          onSubmit={(name) => ctl.renameProfile(modal.profile.id, name)} onClose={() => setModal(null)} />
      )}
      {modal?.type === "delete" && (
        <ConfirmModal title="Eliminar perfil" danger confirm="Eliminar" onConfirm={() => ctl.deleteProfile(modal.profile.id)} onClose={() => setModal(null)}>
          Se eliminará el perfil "{modal.profile.name}".
        </ConfirmModal>
      )}
    </>
  );
}
