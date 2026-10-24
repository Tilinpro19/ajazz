import { useEffect, useState } from "react";
import { Section, Segmented, ConfirmModal, Icon, NumberInput } from "../components.jsx";
import {
  BUTTON_NAMES, MOUSE_ACTIONS, MEDIA_ACTIONS, MODIFIERS, KEYS, MACRO_LOOP_MODES,
  describeAction, keyFromEvent, modifierBit,
} from "../../catalog.js";

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
      {listening ? "Pulsa la combinación…" : describeAction({ kind: "keyboard", ...value })}
    </button>
  );
}

function Editor({ index, action, macros, onApply }) {
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
      <h3>{BUTTON_NAMES[index]}</h3>
      <p className="hint">Actual: <strong>{describeAction(action, macros.map((m) => m.name))}</strong></p>
      <Segmented options={CATEGORIES} value={cat} onChange={setCat} />

      {cat === "mouse" && (
        <div className="choice-grid">
          {MOUSE_ACTIONS.map((m) => (
            <button key={m.label} className={`choice ${same(m.action, action) ? "active" : ""}`} onClick={() => pick(m.action)}>{m.label}</button>
          ))}
        </div>
      )}

      {cat === "media" && (
        <div className="choice-grid">
          {MEDIA_ACTIONS.map((m) => (
            <button key={m.label} className={`choice ${same(m.action, action) ? "active" : ""}`} onClick={() => pick(m.action)}>{m.label}</button>
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
                <input type="checkbox" checked={(kb.modifiers & m.bit) !== 0}
                  onChange={(e) => setKb({ ...kb, modifiers: e.target.checked ? kb.modifiers | m.bit : kb.modifiers & ~m.bit })} />
                {m.label}
              </label>
            ))}
            <select className="select" value={kb.usage} onChange={(e) => setKb({ ...kb, usage: Number(e.target.value) })}>
              <option value={0}>(sin tecla)</option>
              {KEYS.filter((k) => !modifierBit(k.usage)).map((k) => <option key={k.usage} value={k.usage}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <button className="btn primary" disabled={!kb.modifiers && !kb.usage} onClick={() => pick({ kind: "keyboard", ...kb })}>Asignar</button>
          </div>
        </div>
      )}

      {cat === "macro" && (macros.length ? (
        <div className="stack">
          <label className="stack">
            <span>Macro</span>
            <select className="select" value={mc.index} onChange={(e) => setMc({ ...mc, index: Number(e.target.value) })}>
              {macros.map((m, i) => <option key={m.id} value={i}>{m.name} ({m.events.length} eventos)</option>)}
            </select>
          </label>
          <div className="stack">
            <span>Repetición</span>
            {MACRO_LOOP_MODES.map((l) => (
              <label key={l.value} className="radio">
                <input type="radio" name="loop" checked={mc.loop === l.value} onChange={() => setMc({ ...mc, loop: l.value, count: l.value === 0 ? mc.count : 1 })} />
                {l.label}
                {l.value === 0 && mc.loop === 0 && (
                  <NumberInput value={mc.count} min={1} max={255} className="short" onCommit={(n) => setMc({ ...mc, count: n })} />
                )}
              </label>
            ))}
          </div>
          {!macros[mc.index]?.events.length && <p className="hint warn">Esta macro está vacía: grábala en la pestaña Macros.</p>}
          <div>
            <button className="btn primary" disabled={!macros[mc.index]?.events.length} onClick={() => pick({ kind: "macro", ...mc })}>Asignar</button>
          </div>
        </div>
      ) : <p className="hint">Todavía no hay macros. Créalas en la pestaña Macros.</p>)}
    </div>
  );
}

export default function Buttons({ ctl }) {
  const [selected, setSelected] = useState(3);
  const [confirmReset, setConfirmReset] = useState(false);
  const { buttons, store } = ctl;
  const macros = store?.macros || [];
  const names = macros.map((m) => m.name);

  const apply = (a) => {
    const next = [...buttons];
    next[selected] = a;
    ctl.applyButtons(next);
  };

  return (
    <Section
      title="Botones"
      hint="Cada cambio reescribe la tabla completa de 8 botones en el mouse."
      actions={<button className="btn ghost" onClick={() => setConfirmReset(true)}>Restablecer botones</button>}
    >
      <div className="buttons-layout">
        <ul className="button-list">
          {buttons.map((a, i) => (
            <li key={i}>
              <button className={`button-item ${i === selected ? "active" : ""}`} onClick={() => setSelected(i)}>
                <span className="button-num">{i + 1}</span>
                <span className="button-text">
                  <span>{BUTTON_NAMES[i]}</span>
                  <small>{describeAction(a, names)}</small>
                </span>
                {i === 0 && <Icon name="lock" size={14} />}
              </button>
            </li>
          ))}
        </ul>
        {selected === 0 ? (
          <div className="editor">
            <h3>{BUTTON_NAMES[0]}</h3>
            <p className="hint">El clic izquierdo no se puede reasignar (igual que en la web oficial): sin él no podrías usar la app para deshacer el cambio.</p>
          </div>
        ) : (
          <Editor index={selected} action={buttons[selected]} macros={macros} onApply={apply} />
        )}
      </div>
      {confirmReset && (
        <ConfirmModal title="Restablecer botones" confirm="Restablecer" onConfirm={ctl.resetButtons} onClose={() => setConfirmReset(false)}>
          Los 8 botones vuelven a su función de fábrica. Las macros no se borran.
        </ConfirmModal>
      )}
    </Section>
  );
}
