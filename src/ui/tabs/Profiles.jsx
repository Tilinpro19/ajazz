import { useState } from "react";
import { Section, Toggle, Field, PromptModal, ConfirmModal, Icon, ActionButton } from "../components.jsx";
import { Plus } from "@animateicons/react/lucide";
import { inElectron } from "../api.js";

const LIGHT_MODE_NAMES = ["Ola", "Neón", "Destello", "YOYO", "Pulso", "Respiración", "Apagado"];

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
    <div className="rules-container">
      <Field
        label="Perfil predeterminado"
        hint="Se usa cuando ninguna regla coincide con la aplicación activa."
      >
        <select
          className="select"
          value={store.autoSwitch.defaultProfileId}
          onChange={(e) => ctl.setAutoSwitch({ defaultProfileId: e.target.value })}
        >
          {store.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <table className="events rules-table">
        <thead>
          <tr>
            <th>Ejecutable</th>
            <th>Perfil</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.exe}>
              <td><code>{r.exe}</code></td>
              <td><strong>{nameOf(r.profileId)}</strong></td>
              <td className="row-actions text-right">
                <button
                  className="icon-btn"
                  aria-label="Eliminar regla"
                  title="Eliminar regla"
                  onClick={() => ctl.setAutoSwitch({ rules: rules.filter((x) => x !== r) })}
                >
                  <Icon name="x" size={14} />
                </button>
              </td>
            </tr>
          ))}
          {!rules.length && (
            <tr>
              <td colSpan={3} className="hint text-center py-4">
                Sin reglas. Agrega el ejecutable de un juego o programa.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="rule-add-row">
        <input
          className="text"
          placeholder="ejemplo.exe"
          value={exe}
          onChange={(e) => setExe(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add(exe)}
        />
        <select
          className="select"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {store.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <ActionButton icon={Plus} className="btn ghost" disabled={!exe.trim()} onClick={() => add(exe)}>
          Agregar regla
        </ActionButton>
        {foreground && (
          <button className="btn ghost" onClick={() => add(foreground)} title="Proceso en primer plano">
            Usar {foreground}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Profiles({ ctl }) {
  const { store } = ctl;
  const [modal, setModal] = useState(null);
  if (!store) return null;

  return (
    <div className="tab-layout">
      <Section
        title="Perfiles"
        hint="Cada perfil guarda DPI, sondeo, iluminación y botones."
        actions={
          <div className="profile-header-actions">
            <button className="btn ghost" onClick={ctl.importProfileFile}>
              <Icon name="copy" size={13} />
              <span>Importar</span>
            </button>
            <ActionButton icon={Plus} className="btn primary" onClick={() => setModal({ type: "new" })}>
              Nuevo perfil
            </ActionButton>
          </div>
        }
      >
        <div className="profiles-grid">
          {store.profiles.map((p) => {
            const active = p.id === store.activeProfileId;
            const activeDpi = p.config.dpi[p.config.dpi_index] || 1600;
            const pollingHz = p.config.report_rate === 3 ? 1000 : p.config.report_rate === 2 ? 500 : p.config.report_rate === 1 ? 250 : 125;
            const lightName = LIGHT_MODE_NAMES[p.config.light_mode] || "Ola";

            return (
              <div key={p.id} className={`profile profile-card ${active ? "active" : ""}`}>
                <div className="profile-card-header">
                  <div className="profile-card-title-group">
                    <span className="profile-card-name">{p.name}</span>
                  </div>
                  {active ? (
                    <span className="profile-badge active">
                      <span className="badge-glow-dot" />
                      ACTIVO
                    </span>
                  ) : (
                    <button
                      className="btn ghost small"
                      disabled={!ctl.config && ctl.conn.status === "connected"}
                      onClick={() => ctl.switchProfile(p.id)}
                    >
                      Usar
                    </button>
                  )}
                </div>

                <div className="profile-spec-chips">
                  <div className="spec-box">
                    <span className="spec-box-label">DPI</span>
                    <span className="spec-box-val">{activeDpi}</span>
                  </div>
                  <div className="spec-box">
                    <span className="spec-box-label">SONDEO</span>
                    <span className="spec-box-val">{pollingHz} Hz</span>
                  </div>
                  <div className="spec-box">
                    <span className="spec-box-label">RGB</span>
                    <span className="spec-box-val text-cyan">{lightName}</span>
                  </div>
                </div>

                <div className="profile-stages-micro">
                  <div className="micro-stages-label">
                    <span>Niveles</span>
                    <span>{p.config.dpi_count}</span>
                  </div>
                  <div className="micro-stages-bar">
                    {[0, 1, 2, 3, 4, 5].slice(0, p.config.dpi_count).map((stageIdx) => (
                      <div
                        key={stageIdx}
                        className={`micro-stage-segment ${stageIdx === p.config.dpi_index ? "active" : ""}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="profile-card-footer">
                  <button
                    className="icon-action-btn"
                    title="Duplicar perfil"
                    onClick={() => ctl.duplicateProfile(p.id)}
                  >
                    <Icon name="copy" size={14} />
                  </button>
                  <button
                    className="icon-action-btn"
                    title="Renombrar perfil"
                    onClick={() => setModal({ type: "rename", profile: p })}
                  >
                    <Icon name="settings" size={14} />
                  </button>
                  <button
                    className="icon-action-btn"
                    title="Exportar perfil"
                    onClick={() => ctl.exportProfileFile(p.id)}
                  >
                    <Icon name="up" size={14} />
                  </button>
                  {store.profiles.length > 1 && (
                    <button
                      className="icon-action-btn danger"
                      title="Eliminar perfil"
                      onClick={() => setModal({ type: "delete", profile: p })}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Cambio automático por aplicación"
        hint={
          inElectron
            ? "Cambia de perfil según la aplicación en primer plano."
            : "Disponible únicamente en la versión instalada de escritorio."
        }
      >
        <Toggle
          label="Cambiar de perfil automáticamente"
          disabled={!inElectron}
          checked={store.autoSwitch.enabled}
          onChange={(enabled) => ctl.setAutoSwitch({ enabled })}
        />
        {store.autoSwitch.enabled && <Rules ctl={ctl} />}
      </Section>

      {modal?.type === "new" && (
        <PromptModal
          title="Nuevo perfil"
          label="Nombre del perfil (copiará la calibración actual)"
          initial={`Perfil ${store.profiles.length + 1}`}
          confirm="Crear"
          onSubmit={ctl.createProfile}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "rename" && (
        <PromptModal
          title="Renombrar perfil"
          label="Nuevo nombre"
          initial={modal.profile.name}
          confirm="Guardar"
          onSubmit={(name) => ctl.renameProfile(modal.profile.id, name)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "delete" && (
        <ConfirmModal
          title="Eliminar perfil"
          danger
          confirm="Eliminar"
          onConfirm={() => ctl.deleteProfile(modal.profile.id)}
          onClose={() => setModal(null)}
        >
          Se eliminará permanentemente el perfil "{modal.profile.name}".
        </ConfirmModal>
      )}
    </div>
  );
}
