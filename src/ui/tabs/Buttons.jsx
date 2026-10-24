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

// Visualizador SVG interactivo del mouse AJAZZ AJ139 V2 MC
function MouseDiagram({ selected, onSelect }) {
  // Coordenadas de los 8 hotspots numerados (1..8)
  const hotspots = [
    { index: 0, x: 58, y: 72, label: "1", name: "Clic izquierdo" },
    { index: 1, x: 122, y: 72, label: "2", name: "Clic derecho" },
    { index: 2, x: 90, y: 65, label: "3", name: "Clic central" },
    { index: 3, x: 22, y: 154, label: "4", name: "Atrás" },
    { index: 4, x: 22, y: 118, label: "5", name: "Adelante" },
    { index: 5, x: 90, y: 114, label: "6", name: "DPI" },
    { index: 6, x: 90, y: 44, label: "7", name: "Rueda ↑" },
    { index: 7, x: 90, y: 86, label: "8", name: "Rueda ↓" },
  ];

  return (
    <div className="mouse-visualizer">
      <div className="mouse-visualizer-title">Esquema AJ139</div>
      <svg className="mouse-svg" viewBox="0 0 180 290" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="mouseGlow" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#1f293d" />
            <stop offset="100%" stopColor="#10151f" />
          </radialGradient>
          <filter id="accentNeon" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Silueta y cuerpo del mouse */}
        <path
          d="M42 45 C42 18, 62 10, 90 10 C118 10, 138 18, 138 45 C138 68, 148 110, 150 160 C152 210, 144 265, 126 276 C108 285, 72 285, 54 276 C36 265, 28 210, 30 160 C32 110, 42 68, 42 45 Z"
          fill="url(#mouseGlow)"
          stroke="#2d3748"
          strokeWidth="2.5"
        />

        {/* Botones laterales en el flanco izquierdo */}
        {/* Botón 5: Adelante */}
        <path
          d="M24 106 C24 104, 30 106, 31 112 L30 128 C28 132, 24 130, 24 126 Z"
          fill={selected === 4 ? "var(--accent)" : "#202838"}
          stroke={selected === 4 ? "#fff" : "#3b4861"}
          strokeWidth="1.5"
          className="hotspot"
          onClick={() => onSelect(4)}
        />
        {/* Botón 4: Atrás */}
        <path
          d="M24 142 C24 138, 28 138, 30 142 L31 160 C30 166, 24 166, 24 162 Z"
          fill={selected === 3 ? "var(--accent)" : "#202838"}
          stroke={selected === 3 ? "#fff" : "#3b4861"}
          strokeWidth="1.5"
          className="hotspot"
          onClick={() => onSelect(3)}
        />

        {/* Hendidura central superior */}
        <line x1="90" y1="12" x2="90" y2="40" stroke="#252d3d" strokeWidth="2" />
        <line x1="90" y1="125" x2="90" y2="175" stroke="#252d3d" strokeWidth="1.5" />

        {/* Canal central de la rueda */}
        <rect x="80" y="36" width="20" height="62" rx="10" fill="#0d1117" stroke="#2d3748" strokeWidth="1.5" />

        {/* Rueda central */}
        <rect
          x="84"
          y="45"
          width="12"
          height="42"
          rx="6"
          fill={selected === 2 || selected === 6 || selected === 7 ? "var(--accent-soft)" : "#161b24"}
          stroke={selected === 2 ? "var(--accent)" : "#38455c"}
          strokeWidth="2"
          className="hotspot"
          onClick={() => onSelect(2)}
        />
        {/* Ranuras de goma de la rueda */}
        <line x1="86" y1="52" x2="94" y2="52" stroke="#2d3748" strokeWidth="1.5" />
        <line x1="86" y1="59" x2="94" y2="59" stroke="#2d3748" strokeWidth="1.5" />
        <line x1="86" y1="66" x2="94" y2="66" stroke="#2d3748" strokeWidth="1.5" />
        <line x1="86" y1="73" x2="94" y2="73" stroke="#2d3748" strokeWidth="1.5" />
        <line x1="86" y1="80" x2="94" y2="80" stroke="#2d3748" strokeWidth="1.5" />

        {/* Botón DPI (botón 6 en lista, índice 5) */}
        <rect
          x="84"
          y="105"
          width="12"
          height="18"
          rx="5"
          fill={selected === 5 ? "var(--accent)" : "#202838"}
          stroke={selected === 5 ? "#fff" : "#3b4861"}
          strokeWidth="1.5"
          className="hotspot"
          onClick={() => onSelect(5)}
        />

        {/* Línea divisoria curva de la palma */}
        <path d="M42 120 C65 140, 115 140, 138 120" stroke="#1f2736" strokeWidth="1.5" fill="none" />

        {/* Hotspots numerados interactivos */}
        {hotspots.map((h) => {
          const active = selected === h.index;
          return (
            <g
              key={h.index}
              className={`hotspot ${active ? "active" : ""}`}
              onClick={() => onSelect(h.index)}
            >
              <circle
                cx={h.x}
                cy={h.y}
                r={active ? 11 : 9.5}
                fill={active ? "var(--accent)" : "#161c27"}
                stroke={active ? "#ffffff" : "#455570"}
                strokeWidth={active ? 2 : 1.5}
                filter={active ? "url(#accentNeon)" : undefined}
              />
              <text
                x={h.x}
                y={h.y + 3.5}
                textAnchor="middle"
                fontSize={active ? "10.5" : "9.5"}
                fontWeight="700"
                fill={active ? "#031614" : "#94a3b8"}
              >
                {h.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="hint" style={{ textAlign: "center", fontSize: "11px" }}>
        Haz clic en cualquier número para configurar ese botón
      </div>
    </div>
  );
}

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
      <p className="hint">Asignación actual: <strong>{describeAction(action, macros.map((m) => m.name))}</strong></p>
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
              </label>
            ))}
            {mc.loop === 0 && (
              <div className="row">
                <span>Veces</span>
                <NumberInput value={mc.count} min={1} max={255} className="short" onCommit={(n) => setMc({ ...mc, count: n })} />
              </div>
            )}
          </div>
          <div>
            <button className="btn primary" onClick={() => pick({ kind: "macro", ...mc })}>Asignar</button>
          </div>
        </div>
      ) : (
        <p className="hint">No hay macros creadas todavía. Ve a la pestaña <strong>Macros</strong> para crear una.</p>
      ))}
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
        hint="Cada cambio reescribe la tabla completa de 8 botones en el mouse."
        icon="mouse"
        actions={
          <button className="btn ghost" onClick={() => setConfirmReset(true)}>
            Restablecer botones
          </button>
        }
      >
        <div className="buttons-layout">
          <ul className="button-list">
            {buttons.map((b, i) => {
              const active = i === sel;
              const isLeftClick = i === 0;
              return (
                <li key={i}>
                  <button className={`button-item ${active ? "active" : ""}`} onClick={() => setSel(i)}>
                    <span className="button-num">{i + 1}</span>
                    <div className="button-text">
                      <span>{BUTTON_NAMES[i]}</span>
                      <small>{describeAction(b, macros.map((m) => m.name))}</small>
                    </div>
                    {isLeftClick && <Icon name="lock" size={13} title="El botón 1 es el clic principal de seguridad" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <MouseDiagram selected={sel} onSelect={setSel} />

          <Editor
            index={sel}
            action={buttons[sel]}
            macros={macros}
            onApply={(action) => updateButton(sel, action)}
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
