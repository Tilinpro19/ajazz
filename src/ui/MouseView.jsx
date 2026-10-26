import { useState } from "react";
import mouseTransparentImg from "./assets/mouse-transparent.png";
import { BUTTON_NAMES, describeAction } from "../catalog.js";

const BUTTON_CONFIGS = [
  {
    index: 0,
    name: "Left Button",
    label: "Clic izquierdo",
    side: "left",
    card: { x: 26, y: 55, w: 180, h: 54 },
    anchor: { x: 206, y: 82 },
    pin: { x: 332, y: 117 },
    path: "M 206 82 C 265 82, 285 117, 332 117",
    hitbox: { x: 302, y: 30, w: 75, h: 120, rx: 8 },
  },
  {
    index: 1,
    name: "Right Button",
    label: "Clic derecho",
    side: "right",
    card: { x: 554, y: 55, w: 180, h: 54 },
    anchor: { x: 554, y: 82 },
    pin: { x: 431, y: 117 },
    path: "M 554 82 C 495 82, 475 117, 431 117",
    hitbox: { x: 383, y: 30, w: 75, h: 120, rx: 8 },
  },
  {
    index: 2,
    name: "Middle Button",
    label: "Clic central",
    side: "right",
    card: { x: 554, y: 155, w: 180, h: 54 },
    anchor: { x: 554, y: 182 },
    pin: { x: 382, y: 124 },
    path: "M 554 182 C 470 182, 440 124, 382 124",
    hitbox: { x: 371, y: 80, w: 22, h: 65, rx: 6 },
  },
  {
    index: 4,
    name: "Forward",
    label: "Adelante",
    side: "left",
    card: { x: 26, y: 170, w: 180, h: 54 },
    anchor: { x: 206, y: 197 },
    pin: { x: 272, y: 178 },
    path: "M 206 197 C 235 197, 250 178, 272 178",
    hitbox: { x: 264, y: 158, w: 22, h: 38, rx: 4 },
  },
  {
    index: 3,
    name: "Backward",
    label: "Atrás",
    side: "left",
    card: { x: 26, y: 275, w: 180, h: 54 },
    anchor: { x: 206, y: 302 },
    pin: { x: 274, y: 255 },
    path: "M 206 302 C 235 302, 250 255, 274 255",
    hitbox: { x: 266, y: 235, w: 22, h: 42, rx: 4 },
  },
  {
    index: 5,
    name: "DPI",
    label: "Botón DPI",
    side: "right",
    card: { x: 554, y: 265, w: 180, h: 54 },
    anchor: { x: 554, y: 292 },
    pin: { x: 382, y: 214 },
    path: "M 554 292 C 470 292, 440 214, 382 214",
    hitbox: { x: 372, y: 198, w: 20, h: 32, rx: 5 },
  },
];

const WHEEL_CONTROLS = [
  { index: 6, label: "Rueda ↑", name: "Rueda arriba" },
  { index: 7, label: "Rueda ↓", name: "Rueda abajo" },
];

export default function MouseView({
  selected = 0,
  onSelect,
  buttons = [],
  macroNames = [],
  onReset,
}) {
  const [viewMode, setViewMode] = useState("buttons");
  const [hovered, setHovered] = useState(null);

  const getActionDesc = (index) => {
    const action = buttons[index];
    if (!action) return BUTTON_NAMES[index] || "";
    return describeAction(action, macroNames);
  };

  const isCustomized = (index) => {
    const desc = getActionDesc(index);
    const defaultLabel = BUTTON_NAMES[index];
    return desc && desc !== defaultLabel && desc !== "Deshabilitado" && desc !== "Ciclo de DPI";
  };

  return (
    <div className="mouse-view-card">
      <div className="mouse-view-header">
        <div className="mouse-view-title-wrap">
          <span className="mouse-view-model-label">AJ139 V2 MC</span>
        </div>
        <div className="mouse-view-toggle">
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === "buttons" ? "active" : ""}`}
            onClick={() => setViewMode("buttons")}
            title="Ver la asignación de cada botón"
          >
            Asignación
          </button>
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === "clean" ? "active" : ""}`}
            onClick={() => setViewMode("clean")}
            title="Ver el mouse sin etiquetas"
          >
            Vista limpia
          </button>
        </div>
      </div>

      {viewMode === "clean" ? (
        <div className="mouse-clean-stage">
          <div className="mouse-clean-ambient-glow" />
          <img
            src={mouseTransparentImg}
            alt="AJAZZ AJ139 V2 MC"
            className="mouse-clean-img"
          />
          <div className="mouse-clean-pedestal" />
        </div>
      ) : (
        <div className="mouse-stage">
          <svg
            className="mouse-overlay-svg"
            viewBox="0 0 760 460"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="mouseBackdrop" cx="50%" cy="45%" r="50%">
                <stop offset="0%" stopColor="rgba(0, 245, 160, 0.18)" />
                <stop offset="45%" stopColor="rgba(0, 210, 255, 0.08)" />
                <stop offset="85%" stopColor="transparent" />
              </radialGradient>

              <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.5" />
              </filter>
            </defs>

            <ellipse cx="380" cy="235" rx="140" ry="200" fill="url(#mouseBackdrop)" />

            <image
              href={mouseTransparentImg}
              x="265"
              y="20"
              width="230"
              height="424"
              preserveAspectRatio="xMidYMid meet"
              className="mouse-center-render"
            />

            {/* Hitboxes sobre el mouse */}
            {BUTTON_CONFIGS.map((btn) => (
              <rect
                key={`hitbox-${btn.index}`}
                x={btn.hitbox.x}
                y={btn.hitbox.y}
                width={btn.hitbox.w}
                height={btn.hitbox.h}
                rx={btn.hitbox.rx}
                fill="transparent"
                onClick={() => onSelect(btn.index)}
                onMouseEnter={() => setHovered(btn.index)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>{`Seleccionar ${btn.label}`}</title>
              </rect>
            ))}

            {/* Líneas guía y pines */}
            {BUTTON_CONFIGS.map((btn) => {
              const isSelected = selected === btn.index;
              const isHover = hovered === btn.index;
              const active = isSelected || isHover;

              return (
                <g key={`leader-${btn.index}`} className={`leader-group ${active ? "active" : ""}`}>
                  {active && (
                    <path
                      d={btn.path}
                      fill="none"
                      stroke={isSelected ? "#00f5a0" : "#00d2ff"}
                      strokeWidth={isSelected ? 3.5 : 2.5}
                      strokeLinecap="round"
                      opacity={isSelected ? 0.45 : 0.25}
                      filter="url(#neonGlow)"
                    />
                  )}

                  <path
                    d={btn.path}
                    fill="none"
                    stroke={isSelected ? "#00f5a0" : isHover ? "#00d2ff" : "rgba(255,255,255,0.12)"}
                    strokeWidth={isSelected ? 2.2 : 1.4}
                    strokeDasharray={isSelected ? "none" : isHover ? "4 2" : "none"}
                    strokeLinecap="round"
                    className="leader-line"
                  />

                  <g
                    className="mouse-pin-target"
                    onClick={() => onSelect(btn.index)}
                    onMouseEnter={() => setHovered(btn.index)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {isSelected && (
                      <circle
                        cx={btn.pin.x}
                        cy={btn.pin.y}
                        r="11"
                        fill="none"
                        stroke="#00f5a0"
                        strokeWidth="1.5"
                        className="pin-pulse-ring"
                      />
                    )}

                    <circle
                      cx={btn.pin.x}
                      cy={btn.pin.y}
                      r={isSelected ? 7 : active ? 6 : 4.5}
                      fill={active ? "rgba(0, 245, 160, 0.2)" : "#181c24"}
                      stroke={isSelected ? "#00f5a0" : isHover ? "#00d2ff" : "rgba(255,255,255,0.2)"}
                      strokeWidth={isSelected ? 2 : 1.5}
                      className="pin-halo"
                    />

                    <circle
                      cx={btn.pin.x}
                      cy={btn.pin.y}
                      r={isSelected ? 3 : 2}
                      fill={isSelected ? "#ffffff" : isHover ? "#00f5a0" : "rgba(255,255,255,0.4)"}
                      className="pin-core"
                    />
                  </g>
                </g>
              );
            })}

            {/* Tarjetas de botones (Callout Cards) */}
            {BUTTON_CONFIGS.map((btn) => {
              const isSelected = selected === btn.index;
              const isHover = hovered === btn.index;
              const desc = getActionDesc(btn.index);
              const custom = isCustomized(btn.index);
              const card = btn.card;

              return (
                <g
                  key={`card-${btn.index}`}
                  className={`mouse-callout-card ${isSelected ? "selected" : ""} ${isHover ? "hovered" : ""}`}
                  onClick={() => onSelect(btn.index)}
                  onMouseEnter={() => setHovered(btn.index)}
                  onMouseLeave={() => setHovered(null)}
                  filter="url(#cardShadow)"
                >
                  <rect
                    x={card.x}
                    y={card.y}
                    width={card.w}
                    height={card.h}
                    rx="8"
                    className="callout-card-bg"
                    fill={
                      isSelected
                        ? "rgba(0, 245, 160, 0.12)"
                        : isHover
                        ? "rgba(28, 32, 40, 0.95)"
                        : "rgba(15, 19, 28, 0.9)"
                    }
                    stroke={
                      isSelected
                        ? "#00f5a0"
                        : isHover
                        ? "#00d2ff"
                        : "rgba(255, 255, 255, 0.1)"
                    }
                    strokeWidth={isSelected ? 1.8 : 1}
                  />

                  <circle
                    cx={card.x + 22}
                    cy={card.y + 27}
                    r="12"
                    fill={isSelected ? "#00f5a0" : isHover ? "#00d2ff" : "#262a33"}
                    stroke={isSelected ? "#00f5a0" : isHover ? "#00d2ff" : "rgba(255,255,255,0.12)"}
                    strokeWidth="1"
                    className="callout-num-circle"
                  />
                  <text
                    x={card.x + 22}
                    y={card.y + 31.5}
                    textAnchor="middle"
                    fill={isSelected || isHover ? "#0b0f17" : "#dfe2ee"}
                    fontSize="11.5"
                    fontWeight="700"
                    fontFamily="inherit"
                    className="callout-num-text"
                  >
                    {btn.index + 1}
                  </text>

                  <text
                    x={card.x + 42}
                    y={card.y + 22}
                    fill={isSelected ? "#ffffff" : isHover ? "#ffffff" : "#dfe2ee"}
                    fontSize="13"
                    fontWeight="600"
                    fontFamily="inherit"
                    className="callout-title"
                  >
                    {btn.label}
                  </text>

                  <text
                    x={card.x + 42}
                    y={card.y + 41}
                    fill={
                      custom
                        ? "#00f5a0"
                        : isSelected
                        ? "#cdffde"
                        : "#849588"
                    }
                    fontSize="11.5"
                    fontWeight={custom || isSelected ? "500" : "400"}
                    fontFamily="inherit"
                    className="callout-desc"
                  >
                    {desc.length > 18 ? desc.slice(0, 17) + "…" : desc}
                  </text>

                  {custom && (
                    <circle
                      cx={card.x + card.w - 12}
                      cy={card.y + 14}
                      r="3.5"
                      fill="#00f5a0"
                      className="callout-custom-dot"
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Barra inferior: rueda de scroll */}
          <div className="mouse-stage-footer-bar">
            <div className="wheel-subcontrols">
              <span className="wheel-label">Rueda:</span>
              {WHEEL_CONTROLS.map((w) => {
                const active = selected === w.index;
                const desc = getActionDesc(w.index);
                return (
                  <button
                    key={w.index}
                    type="button"
                    className={`wheel-chip ${active ? "active" : ""}`}
                    onClick={() => onSelect(w.index)}
                    title={`${w.name}: ${desc}`}
                  >
                    <span className="wheel-chip-num">{w.index + 1}</span>
                    <span className="wheel-chip-title">{w.label}</span>
                    <span className="wheel-chip-val">{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
