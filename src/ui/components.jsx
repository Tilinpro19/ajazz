import { useEffect, useRef, useState } from "react";

export function Section({ title, hint, children, actions }) {
  return (
    <section className="section">
      <header className="section-head">
        <div>
          <h2>{title}</h2>
          {hint && <p className="hint">{hint}</p>}
        </div>
        {actions && <div className="section-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`toggle ${disabled ? "is-disabled" : ""}`}>
      <span className="toggle-text">
        <span>{label}</span>
        {hint && <small className="hint">{hint}</small>}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track"><span className="toggle-thumb" /></span>
    </label>
  );
}

// Grupo de botones de opción única.
export function Segmented({ options, value, onChange, disabled }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? "active" : ""}
          disabled={disabled || o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      <div className="field-label">
        <span>{label}</span>
        {hint && <small className="hint">{hint}</small>}
      </div>
      <div className="field-control">{children}</div>
    </div>
  );
}

// Entrada numérica que solo confirma al salir o con Enter (evita una escritura por tecla).
export function NumberInput({ value, min, max, step = 1, onCommit, disabled, className = "" }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    let n = Number(draft);
    if (!Number.isFinite(n)) return setDraft(String(value));
    n = Math.round(n / step) * step;
    n = Math.min(max, Math.max(min, n));
    setDraft(String(n));
    if (n !== value) onCommit(n);
  };
  return (
    <input
      className={`number ${className}`}
      type="number"
      value={draft}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

export function Modal({ title, children, onClose, actions }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}

// Pide un texto (nombre de perfil o macro).
export function PromptModal({ title, label, initial = "", confirm = "Aceptar", onSubmit, onClose }) {
  const [text, setText] = useState(initial);
  const submit = () => {
    if (text.trim()) {
      onSubmit(text.trim());
      onClose();
    }
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={<>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!text.trim()} onClick={submit}>{confirm}</button>
      </>}
    >
      <label className="stack">
        <span>{label}</span>
        <input autoFocus className="text" value={text} maxLength={40} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
      </label>
    </Modal>
  );
}

export function ConfirmModal({ title, children, confirm = "Confirmar", danger, onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={<>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className={`btn ${danger ? "danger" : "primary"}`} onClick={() => { onConfirm(); onClose(); }}>{confirm}</button>
      </>}
    >
      {children}
    </Modal>
  );
}

export function Toasts({ items }) {
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
    </div>
  );
}

export function Icon({ name, size = 18 }) {
  const paths = {
    gauge: "M12 14l4-4M4.9 19a9 9 0 1 1 14.2 0",
    mouse: "M12 3a6 6 0 0 0-6 6v6a6 6 0 0 0 12 0V9a6 6 0 0 0-6-6zM12 7v4",
    macro: "M4 6h16M4 12h10M4 18h7M17 15l4 3-4 3z",
    light: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    profiles: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    usb: "M12 2v14M8 6l4-4 4 4M7 12v2a5 5 0 0 0 10 0v-2M12 19v3",
    wireless: "M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01M2 9a15 15 0 0 1 20 0",
    bolt: "M13 2L3 14h9l-1 8 10-12h-9z",
    up: "M12 19V5M5 12l7-7 7 7",
    down: "M12 5v14M19 12l-7 7-7-7",
    x: "M18 6L6 18M6 6l12 12",
    plus: "M12 5v14M5 12h14",
    record: "M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0",
    stop: "M6 6h12v12H6z",
    lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function Battery({ level, charging }) {
  const color = level <= 15 ? "var(--danger)" : level <= 35 ? "var(--warn)" : "var(--ok)";
  return (
    <span className="battery" title={charging ? "Cargando" : "Batería"}>
      <span className="battery-body"><span className="battery-fill" style={{ width: `${level}%`, background: color }} /></span>
      <span>{level}%</span>
      {charging && <Icon name="bolt" size={14} />}
    </span>
  );
}
