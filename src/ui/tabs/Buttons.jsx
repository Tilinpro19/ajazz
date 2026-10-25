import { useEffect, useState } from "react";
import { Section, Segmented, ConfirmModal, Icon, NumberInput } from "../components.jsx";
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

// Captura una combinación: modificadores + una tecla.
function KeyCapture({ value, onChange }) {
  const [listening, setListening] = useState(false);
  const onKeyDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const key = keyFromEvent(e);
    let mods = (e.ctrlKey ? 1 : 0) | (e.shiftKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0);
    if (key && modifierBit(key.usage)) {
      // Solo un modificador: se guarda como modificador sin tecla.
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
      {listening ? "Pulsa la combinación en el teclado…" : describeAction({ kind: "keyboard", ...value })}
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
    <div className="editor">
      <div className="editor-header">
        <div className="editor-button-badge">
          <span className="editor-badge-num">{index + 1}</span>
          <span className="editor-badge-name">{BUTTON_NAMES[index]}</span>
        </div>
        <select
          className="select editor-quick-select"
          value={index}
          onChange={(e) => onSelectButton(Number(e.target.value))}
          title="Cambiar botón a editar"
        >
          {BUTTON_NAMES.map((name, i) => (
            <option key={i} value={i}>
              {i + 1}. {name}
            </option>
          ))}
        </select>
      </div>

      <p className="hint">
        Asignación actual: <strong>{describeAction(action, macros.map((m) => m.name))}</strong>
      </p>

      <Segmented options={CATEGORIES} value={cat} onChange={setCat} />

      {cat === "mouse" && (
        <div className="choice-grid">
          {MOUSE_ACTIONS.map((m) => (
            <button
              key={m.label}
              className={`choice ${same(m.action, action) ? "active" : ""}`}
              onClick={() => pick(m.action)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {cat === "media" && (
        <div className="choice-grid">
          {MEDIA_ACTIONS.map((m) => (
            <button
              key={m.label}
              className={`choice ${same(m.action, action) ? "active" : ""}`}
              onClick={() => pick(m.action)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {cat === "keyboard" && (
        <div className="stack">
          <p className="hint">Haz clic en el recuadro y pulsa la tecla o combinación (p. ej. Ctrl + C).</p>
          <KeyCapture value={kb} onChange={setKb} />
          <div className="row wrap">
            {MODIFIERS.map((m) => (
              <label key={m.bit} className="check">
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
                {m.label}
              </label>
            ))}
            <select
              className="select"
              value={kb.usage}
              onChange={(e) => setKb({ ...kb, usage: Number(e.target.value) })}
            >
              <option value={0}>(sin tecla)</option>
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
          <div className="stack">
            <label className="stack">
              <span>Macro</span>
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
            </label>
            <div className="stack">
              <span>Repetición</span>
              {MACRO_LOOP_MODES.map((l) => (
                <label key={l.value} className="radio">
                  <input
                    type="radio"
                    name="loop"
                    checked={mc.loop === l.value}
                    onChange={() =>
                      setMc({ ...mc, loop: l.value, count: l.value === 0 ? mc.count : 1 })
                    }
                  />
                  {l.label}
                </label>
              ))}
              {mc.loop === 0 && (
                <div className="row">
                  <span>Veces</span>
                  <NumberInput
                    value={mc.count}
                    min={1}
                    max={255}
                    className="short"
                    onCommit={(n) => setMc({ ...mc, count: n })}
                  />
                </div>
              )}
            </div>
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
            No hay macros creadas todavía. Ve a la pestaña <strong>Macros</strong> para crear una.
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
    <>
      <Section
        title="Botones"
        hint="Haz clic en cualquier botón del diagrama interactivo o de la lista para reasignar su función."
        icon="mouse"
        actions={
          <button className="btn ghost" onClick={() => setConfirmReset(true)}>
            <Icon name="refresh" size={13} /> Restablecer botones
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

            <div className="button-quick-list">
              <div className="button-quick-list-title">Lista rápida de botones</div>
              <ul className="button-list button-list-grid">
                {buttons.map((b, i) => {
                  const active = i === sel;
                  const isLeftClick = i === 0;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={`button-item ${active ? "active" : ""}`}
                        onClick={() => setSel(i)}
                      >
                        <span className="button-num">{i + 1}</span>
                        <div className="button-text">
                          <span>{BUTTON_NAMES[i]}</span>
                          <small>{describeAction(b, macros.map((m) => m.name))}</small>
                        </div>
                        {isLeftClick && (
                          <Icon
                            name="lock"
                            size={13}
                            title="El botón 1 es el clic principal de seguridad"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
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
          <p>Se restaurará la asignación original de los 8 botones:</p>
          <ul className="tips">
            <li>1: Clic izquierdo · 2: Clic derecho · 3: Clic central</li>
            <li>4: Atrás · 5: Adelante · 6: Ciclo de DPI</li>
            <li>7: Rueda arriba · 8: Rueda abajo</li>
          </ul>
        </ConfirmModal>
      )}
    </>
  );
}
