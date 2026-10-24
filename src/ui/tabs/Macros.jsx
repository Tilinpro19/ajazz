import { useEffect, useRef, useState } from "react";
import { Section, Segmented, NumberInput, PromptModal, ConfirmModal, Icon, ActionButton } from "../components.jsx";
import { Plus, CircleDot, CircleStop } from "@animateicons/react/lucide";
import { keyFromEvent, keyLabel, mouseButtonFromEvent, mouseButtonLabel, MACRO_MOUSE_BUTTONS, KEYS } from "../../catalog.js";
import { encodeMacros } from "../../protocol.js";

const MACRO_BYTES = 4096;
const DELAY_MODES = [
  { value: "real", label: "Retardos reales" },
  { value: "fixed", label: "Retardo fijo" },
  { value: "none", label: "Sin retardo" },
];

const eventLabel = (e) => (e.device === "mouse" ? mouseButtonLabel(e.code) : keyLabel(e.code));

// Graba eventos de teclado y mouse dentro del recuadro. El retardo de cada evento es
// la espera hasta el siguiente (igual que la web oficial).
function Recorder({ delayMode, fixedDelay, onDone }) {
  const ref = useRef(null);
  const [events, setEvents] = useState([]);
  const last = useRef(null);
  useEffect(() => ref.current?.focus(), []);

  const push = (device, code, down) => {
    const now = performance.now();
    setEvents((list) => {
      const out = [...list];
      if (out.length) {
        const gap = delayMode === "real" ? Math.max(0, Math.round(now - last.current)) : delayMode === "fixed" ? fixedDelay : 0;
        out[out.length - 1] = { ...out[out.length - 1], delay: Math.min(gap, 65535) };
      }
      out.push({ device, code, down, delay: delayMode === "fixed" ? fixedDelay : 0 });
      return out;
    });
    last.current = now;
  };

  const onKey = (down) => (e) => {
    e.preventDefault();
    if (e.repeat) return;
    const key = keyFromEvent(e);
    if (key) push("keyboard", key.usage, down);
  };
  const onMouse = (down) => (e) => {
    e.preventDefault();
    const b = mouseButtonFromEvent(e);
    if (b) push("mouse", b.code, down);
  };

  return (
    <div className="recorder">
      <div
        ref={ref}
        tabIndex={0}
        className="record-area"
        onKeyDown={onKey(true)}
        onKeyUp={onKey(false)}
        onMouseDown={onMouse(true)}
        onMouseUp={onMouse(false)}
        onContextMenu={(e) => e.preventDefault()}
        onBlur={() => ref.current?.focus()}
      >
        <div>
          <span className="rec-dot" />
          <strong>Grabando:</strong> pulsa teclas o haz clic dentro de este recuadro
        </div>
        <div className="rec-live">
          {events.slice(-10).map((e, i) => (
            <span key={i} className={`chip ${e.down ? "down" : "up"}`}>
              {e.device === "mouse" ? "🖱️ " : "⌨️ "}
              {eventLabel(e)} {e.down ? "↓" : "↑"}
            </span>
          ))}
        </div>
      </div>
      <div className="row spread">
        <span className="hint">{events.length} eventos capturados</span>
        <div className="row">
          <button className="btn ghost" onClick={() => onDone(null)}>Cancelar</button>
          <ActionButton icon={CircleStop} className="btn primary" onClick={() => onDone(events)}>
            Terminar
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function AddEvents({ onAdd }) {
  const [key, setKey] = useState(4);
  const [btn, setBtn] = useState(1);
  const pair = (device, code) => [{ device, code, down: true, delay: 10 }, { device, code, down: false, delay: 10 }];
  return (
    <div className="row wrap">
      <select className="select" value={key} onChange={(e) => setKey(Number(e.target.value))}>
        {KEYS.map((k) => <option key={k.usage} value={k.usage}>{k.label}</option>)}
      </select>
      <button className="btn ghost" onClick={() => onAdd(pair("keyboard", key))}><Icon name="plus" size={14} /> Tecla</button>
      <select className="select" value={btn} onChange={(e) => setBtn(Number(e.target.value))}>
        {MACRO_MOUSE_BUTTONS.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
      </select>
      <button className="btn ghost" onClick={() => onAdd(pair("mouse", btn))}><Icon name="plus" size={14} /> Clic</button>
    </div>
  );
}

export default function Macros({ ctl }) {
  const macros = ctl.store?.macros || [];
  const [sel, setSel] = useState(0);
  const [recording, setRecording] = useState(false);
  const [delayMode, setDelayMode] = useState("real");
  const [fixedDelay, setFixedDelay] = useState(20);
  const [modal, setModal] = useState(null);
  const current = macros[sel];

  useEffect(() => {
    if (sel >= macros.length) setSel(Math.max(0, macros.length - 1));
  }, [macros.length, sel]);

  let used = 0;
  try {
    used = encodeMacros(macros.map((m) => m.events)).length;
  } catch {
    used = MACRO_BYTES + 1;
  }

  const usedPct = Math.min(100, Math.round((used / MACRO_BYTES) * 100));
  const setEvents = (fn) => ctl.setMacros((list) => list.map((m, i) => (i === sel ? { ...m, events: fn(m.events) } : m)));
  const editEvent = (i, patch) => setEvents((evs) => evs.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const move = (i, d) => setEvents((evs) => {
    const out = [...evs];
    [out[i], out[i + d]] = [out[i + d], out[i]];
    return out;
  });

  return (
    <Section
      title="Macros"
      hint="Las macros se guardan en el PC y se escriben todas juntas en la memoria del mouse. Luego asígnalas a un botón."
      icon="macro"
      actions={<>
        <div className="memory-meter" title={`Memoria de macros en mouse: ${used} / ${MACRO_BYTES} bytes (${usedPct}%)`}>
          <span className={`usage ${used > MACRO_BYTES ? "over" : ""}`}>
            {Math.min(used, 9999)} / {MACRO_BYTES} bytes ({usedPct}%)
          </span>
          <div className="memory-meter-bar">
            <div
              className={`memory-meter-fill ${usedPct > 90 ? "danger" : usedPct > 70 ? "warn" : ""}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
        <button className="btn primary" disabled={!ctl.macrosDirty || used > MACRO_BYTES || !ctl.config} onClick={ctl.writeMacros}>
          {ctl.macrosDirty ? "Guardar en el mouse" : "Sin cambios pendientes"}
        </button>
      </>}
    >
      <div className="macro-layout">
        <aside className="macro-list">
          <ActionButton icon={Plus} className="btn ghost full" disabled={macros.length >= 32} onClick={() => setModal("new")}>
            Nueva macro
          </ActionButton>
          <ul>
            {macros.map((m, i) => (
              <li key={m.id}>
                <button className={`macro-item ${i === sel ? "active" : ""}`} onClick={() => { setSel(i); setRecording(false); }}>
                  <span>{m.name}</span>
                  <small>{m.events.length} eventos</small>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="macro-editor">
          {!current ? <p className="hint">Crea una macro para empezar a grabar.</p> : (
            <>
              <div className="row spread">
                <h3>{current.name}</h3>
                <div className="row">
                  <button className="btn ghost" onClick={() => setModal("rename")}>Renombrar</button>
                  <button className="btn ghost danger-text" onClick={() => setModal("delete")}>Eliminar</button>
                </div>
              </div>

              <div className="row wrap">
                <Segmented options={DELAY_MODES} value={delayMode} onChange={setDelayMode} disabled={recording} />
                {delayMode === "fixed" && (
                  <div className="row">
                    <NumberInput value={fixedDelay} min={1} max={10000} className="short" onCommit={setFixedDelay} />
                    <span className="hint">ms</span>
                  </div>
                )}
                {!recording && (
                  <ActionButton icon={CircleDot} className="btn record" onClick={() => setRecording(true)}>
                    Grabar
                  </ActionButton>
                )}
              </div>

              {recording ? (
                <Recorder
                  delayMode={delayMode}
                  fixedDelay={fixedDelay}
                  onDone={(evs) => {
                    setRecording(false);
                    if (evs?.length) setEvents(() => evs);
                  }}
                />
              ) : (
                <>
                  <table className="events">
                    <thead>
                      <tr><th>#</th><th>Tipo</th><th>Tecla / botón</th><th>Acción</th><th>Espera después (ms)</th><th /></tr>
                    </thead>
                    <tbody>
                      {current.events.map((e, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>
                            <span className="pill">
                              {e.device === "mouse" ? "Mouse" : "Teclado"}
                            </span>
                          </td>
                          <td><strong>{eventLabel(e)}</strong></td>
                          <td>
                            <select className="select small" value={e.down ? "1" : "0"} onChange={(ev) => editEvent(i, { down: ev.target.value === "1" })}>
                              <option value="1">Pulsar</option>
                              <option value="0">Soltar</option>
                            </select>
                          </td>
                          <td><NumberInput value={Math.max(0, e.delay)} min={0} max={65535} className="short" onCommit={(n) => editEvent(i, { delay: n })} /></td>
                          <td className="row-actions">
                            <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title="Subir"><Icon name="up" size={14} /></button>
                            <button className="icon-btn" disabled={i === current.events.length - 1} onClick={() => move(i, 1)} title="Bajar"><Icon name="down" size={14} /></button>
                            <button className="icon-btn" onClick={() => setEvents((evs) => evs.filter((_, j) => j !== i))} title="Quitar"><Icon name="x" size={14} /></button>
                          </td>
                        </tr>
                      ))}
                      {!current.events.length && <tr><td colSpan={6} className="hint">Sin eventos. Pulsa Grabar o agrega teclas abajo.</td></tr>}
                    </tbody>
                  </table>
                  <div className="row spread wrap">
                    <AddEvents onAdd={(evs) => setEvents((list) => [...list, ...evs])} />
                    <div className="row">
                      <button className="btn ghost" disabled={!current.events.length}
                        onClick={() => setEvents((evs) => evs.map((e) => ({ ...e, delay: fixedDelay })))}>
                        Poner {fixedDelay} ms en todos
                      </button>
                      <button className="btn ghost" disabled={!current.events.length} onClick={() => setEvents(() => [])}>Vaciar</button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {modal === "new" && (
        <PromptModal title="Nueva macro" label="Nombre" initial={`Macro ${macros.length + 1}`} confirm="Crear"
          onSubmit={(name) => { ctl.addMacro(name); setSel(macros.length); }} onClose={() => setModal(null)} />
      )}
      {modal === "rename" && current && (
        <PromptModal title="Renombrar macro" label="Nombre" initial={current.name}
          onSubmit={(name) => ctl.setMacros((list) => list.map((m, i) => (i === sel ? { ...m, name } : m)))} onClose={() => setModal(null)} />
      )}
      {modal === "delete" && current && (
        <ConfirmModal title="Eliminar macro" danger confirm="Eliminar" onConfirm={() => ctl.deleteMacro(sel)} onClose={() => setModal(null)}>
          Se eliminará "{current.name}". Los botones que la usaban vuelven a su función de fábrica.
        </ConfirmModal>
      )}
    </Section>
  );
}
