import { useEffect, useState } from "react";
import { Section, Segmented, ConfirmModal, Icon, NumberInput, Field } from "../components.jsx";
import {
  BUTTON_NAMES, MOUSE_ACTIONS, MEDIA_ACTIONS, MODIFIERS, KEYS, MACRO_LOOP_MODES,
  describeAction, keyFromEvent, modifierBit,
} from "../../catalog.js";
import MouseView from "../MouseView.jsx";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CATEGORIES = [
  { value: "mouse", label: "Mouse" },
  { value: "media", label: "Multimedia" },
  { value: "keyboard", label: "Teclado" },
  { value: "macro", label: "Macro" },
];
const categoryOf = (a) => (a.kind === "wheel" || a.kind === "dpi" ? "mouse" : CATEGORIES.some((c) => c.value === a.kind) ? a.kind : "mouse");

function KeyCapture({ value, onChange }) {
  const [listening, setListening] = useState(false);
  const onKeyDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const key = keyFromEvent(e);
    let mods = (e.ctrlKey ? 1 : 0) | (e.shiftKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0);
    if (key && modifierBit(key.usage)) {
      onChange({ modifiers: mods | modifierBit(key.usage), usage: 0 });
      return;
    }
    if (key) {
      onChange({ modifiers: mods, usage: key.usage });
      setListening(false);
      e.currentTarget.blur();
    }
  };
  return (
    <button
      type="button"
      className={`key-capture ${listening ? "listening" : ""}`}
      onFocus={() => setListening(true)}
      onBlur={() => setListening(false)}
      onKeyDown={onKeyDown}
    >
      {listening ? "Pulsa el atajo deseado…" : describeAction({ kind: "keyboard", ...value })}
    </button>
  );
}

function Editor({ index, action, macros, onApply, onSelectButton }) {
  const [cat, setCat] = useState(categoryOf(action));
  const [kb, setKb] = useState(action.kind === "keyboard" ? { modifiers: action.modifiers, usage: action.usage } : { modifiers: 0, usage: 0 });
  const [mc, setMc] = useState(action.kind === "macro" ? { index: action.index, count: action.count, loop: action.loop } : { index: 0, count: 1, loop: 0 });

  useEffect(() => {
    setCat(categoryOf(action));
    if (action.kind === "keyboard") setKb({ modifiers: action.modifiers, usage: action.usage });
    if (action.kind === "macro") setMc({ index: action.index, count: action.count, loop: action.loop });
  }, [index, action]);

  const pick = (a) => !same(a, action) && onApply(a);

  return (
    <div className="editor editor-card">
      <div className="editor-header">
        <div className="editor-badge">
          <span className="badge-num">{index + 1}</span>
          <span className="badge-name">{BUTTON_NAMES[index]}</span>
        </div>
        <select
          className="select quick-select"
          value={index}
          onChange={(e) => onSelectButton(Number(e.target.value))}
          title="Cambiar botón a configurar"
        >
          {BUTTON_NAMES.map((name, i) => (
            <option key={i} value={i}>
              {i + 1}. {name}
            </option>
          ))}
        </select>
      </div>

      <div className="active-assignment-banner">
        <span className="meta-label">Asignación actual:</span>
        <strong className="active-assignment-text">
          {describeAction(action, macros.map((m) => m.name))}
        </strong>
      </div>

      <Segmented options={CATEGORIES} value={cat} onChange={setCat} />

      {cat === "mouse" && (
        <div className="command-grid">
          {MOUSE_ACTIONS.map((m) => {
            const active = same(m.action, action);
            return (
              <button
                key={m.label}
                type="button"
                className={`choice command-item ${active ? "active" : ""}`}
                onClick={() => pick(m.action)}
              >
                <div className="command-item-text">
                  <span className="command-name">{m.label}</span>
                </div>
                {active && <span className="active-dot" />}
              </button>
            );
          })}
        </div>
      )}

      {cat === "media" && (
        <div className="command-grid">
          {MEDIA_ACTIONS.map((m) => {
            const active = same(m.action, action);
            return (
              <button
                key={m.label}
                type="button"
                className={`choice command-item ${active ? "active" : ""}`}
                onClick={() => pick(m.action)}
              >
                <div className="command-item-text">
                  <span className="command-name">{m.label}</span>
                </div>
                {active && <span className="active-dot" />}
              </button>
            );
          })}
        </div>
      )}

      {cat === "keyboard" && (
        <div className="keyboard-editor-stack">
          <KeyCapture value={kb} onChange={setKb} />
          <div className="modifier-row">
            {MODIFIERS.map((m) => (
              <label key={m.bit} className="check-chip">
                <input
                  type="checkbox"
                  checked={(kb.modifiers & m.bit) !== 0}
                  onChange={(e) =>
                    setKb({
                      ...kb,
                      modifiers: e.target.checked ? kb.modifiers | m.bit : kb.modifiers & ~m.bit,
                    })
                  }
                />
                <span>{m.label}</span>
              </label>
            ))}
            <select
              className="select key-select"
              value={kb.usage}
              onChange={(e) => setKb({ ...kb, usage: Number(e.target.value) })}
            >
              <option value={0}>(Sin tecla)</option>
              {KEYS.filter((k) => !modifierBit(k.usage)).map((k) => (
                <option key={k.usage} value={k.usage}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              className="btn primary"
              disabled={!kb.modifiers && !kb.usage}
              onClick={() => pick({ kind: "keyboard", ...kb })}
            >
              Asignar
            </button>
          </div>
        </div>
      )}

      {cat === "macro" && (
        macros.length ? (
          <div className="macro-assign-stack">
            <Field label="Macro seleccionada">
              <select
                className="select"
                value={mc.index}
                onChange={(e) => setMc({ ...mc, index: Number(e.target.value) })}
              >
                {macros.map((m, i) => (
                  <option key={m.id} value={i}>
                    {m.name} ({m.events.length} eventos)
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Modo de ejecución">
              <div className="radio-group">
                {MACRO_LOOP_MODES.map((l) => (
                  <label key={l.value} className="radio-pill">
                    <input
                      type="radio"
                      name="loop"
                      checked={mc.loop === l.value}
                      onChange={() =>
                        setMc({ ...mc, loop: l.value, count: l.value === 0 ? mc.count : 1 })
                      }
                    />
                    <span>{l.label}</span>
                  </label>
                ))}
              </div>
            </Field>

            {mc.loop === 0 && (
              <Field label="Repeticiones">
                <NumberInput
                  value={mc.count}
                  min={1}
                  max={255}
                  className="short"
                  onCommit={(n) => setMc({ ...mc, count: n })}
                />
              </Field>
            )}

            <div>
              <button
                className="btn primary"
                onClick={() => pick({ kind: "macro", ...mc })}
              >
                Asignar
              </button>
            </div>
          </div>
        ) : (
          <p className="hint">
            No hay macros registradas. Crea una secuencia en la pestaña <strong>Macros</strong>.
          </p>
        )
      )}
    </div>
  );
}

export default function Buttons({ ctl }) {
  const { buttons, store } = ctl;
  const [sel, setSel] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const macros = store?.macros || [];

  const updateButton = (index, action) => {
    const next = [...buttons];
    next[index] = action;
    ctl.applyButtons(next);
  };

  return (
    <div className="tab-layout">
      <Section
        title="Asignación de botones"
        hint="Selecciona un botón del mouse para cambiar su función."
        actions={
          <button className="btn ghost" onClick={() => setConfirmReset(true)}>
            <Icon name="refresh" size={13} />
            <span>Valores de fábrica</span>
          </button>
        }
      >
        <div className="buttons-layout">
          <div className="buttons-main-col">
            <MouseView
              selected={sel}
              onSelect={setSel}
              buttons={buttons}
              macroNames={macros.map((m) => m.name)}
              onReset={() => setConfirmReset(true)}
            />
          </div>

          <Editor
            index={sel}
            action={buttons[sel]}
            macros={macros}
            onApply={(action) => updateButton(sel, action)}
            onSelectButton={setSel}
          />
        </div>
      </Section>

      {confirmReset && (
        <ConfirmModal
          title="Restablecer botones de fábrica"
          danger
          confirm="Restablecer"
          onConfirm={ctl.resetButtons}
          onClose={() => setConfirmReset(false)}
        >
          <p>Se restaurará la configuración por defecto de los 8 controles:</p>
          <ul className="tips">
            <li>1: Clic izquierdo · 2: Clic derecho · 3: Clic central</li>
            <li>4: Atrás · 5: Adelante · 6: Ciclo de DPI</li>
            <li>7: Rueda arriba · 8: Rueda abajo</li>
          </ul>
        </ConfirmModal>
      )}
    </div>
  );
}
