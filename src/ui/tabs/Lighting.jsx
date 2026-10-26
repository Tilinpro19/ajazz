import { Section, Icon } from "../components.jsx";
import { LIGHT_EFFECTS } from "../../catalog.js";

export default function Lighting({ ctl }) {
  const mode = ctl.config.light_mode;

  return (
    <div className="tab-layout">
      <Section
        title="Iluminación"
        badge="RGB CONTROLLER"
        hint="Efectos de hardware almacenados en la memoria interna del mouse."
        actions={
          <span className="pill">
            <Icon name="sparkles" size={13} />
            <span>7 Modos disponibles</span>
          </span>
        }
      >
        <div className="lighting-bento-layout">
          {/* Left: Dynamic Hardware Lighting Simulation Showcase */}
          <div className="lighting-stage-card">
            <div className={`lighting-ambient-glow fx-glow-${mode}`} />

            <div className="lighting-stage-header">
              <div className="stage-title-wrap">
                <span className="stage-icon">
                  <Icon name="sparkles" size={14} />
                </span>
                <span className="stage-title">Previsualización en vivo</span>
              </div>
              <span className="sync-chip">
                <Icon name="check" size={12} />
                <span>Hardware Sync</span>
              </span>
            </div>

            {/* Vectorial Silhouette of Mouse + Charging Dock */}
            <div className="lighting-vector-stage">
              <svg
                className="lighting-mouse-svg"
                viewBox="0 0 320 280"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#252c38" />
                    <stop offset="40%" stopColor="#171c26" />
                    <stop offset="100%" stopColor="#0c0e14" />
                  </linearGradient>
                  <linearGradient id="dockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1a202c" />
                    <stop offset="100%" stopColor="#0d1117" />
                  </linearGradient>
                  <filter id="rgbBloom" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Charging Dock Pedestal */}
                <path
                  d="M 60 250 L 110 200 L 210 200 L 260 250 Z"
                  fill="url(#dockGrad)"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1.5"
                />
                <path
                  d="M 90 242 L 120 208 L 200 208 L 230 242"
                  fill="none"
                  className={`dock-rgb-strip fx-light-${mode}`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#rgbBloom)"
                />

                {/* Mouse Chassis Outline */}
                <path
                  d="M 160 30 C 130 30, 110 60, 108 120 C 106 170, 115 220, 160 220 C 205 220, 214 170, 212 120 C 210 60, 190 30, 160 30 Z"
                  fill="url(#bodyGrad)"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="1.5"
                />

                {/* Mouse Wheel */}
                <rect
                  x="153"
                  y="52"
                  width="14"
                  height="34"
                  rx="5"
                  fill="#0c0e14"
                  stroke="rgba(255,255,255,0.2)"
                />
                <rect
                  x="156"
                  y="57"
                  width="8"
                  height="24"
                  rx="3"
                  className={`wheel-rgb-core fx-light-${mode}`}
                  filter="url(#rgbBloom)"
                />

                {/* Click Seam */}
                <path d="M 160 86 L 160 130" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" />

                {/* Ajazz Rear Logo / Illuminated Tail Zone */}
                <path
                  d="M 148 165 L 160 152 L 172 165 L 160 178 Z"
                  className={`mouse-rgb-logo fx-light-${mode}`}
                  filter="url(#rgbBloom)"
                />
              </svg>
            </div>

            <div className="lighting-stage-footer">
              <span className="active-effect-title">
                {LIGHT_EFFECTS.find((e) => e.value === mode)?.label || "Efecto activo"}
              </span>
              <span className="active-effect-mode">Modo HW {mode}</span>
            </div>
          </div>

          {/* Right: Lighting Presets Selection Grid */}
          <div className="lighting-presets-column">
            <div className="lighting-presets-title">Efectos configurables</div>
            <div className="lighting-cards-grid">
              {LIGHT_EFFECTS.map((e) => {
                const active = mode === e.value;
                return (
                  <button
                    key={e.value}
                    type="button"
                    className={`light-card ${active ? "active" : ""}`}
                    onClick={() => mode !== e.value && ctl.applyLight(e.value)}
                  >
                    <div className="light-card-left">
                      <span className={`light-preview fx-${e.value}`} />
                      <div className="light-card-text">
                        <span className="light-name">{e.label}</span>
                        <span className="light-hint">{e.hint}</span>
                      </div>
                    </div>
                    {active && <span className="active-pill">ACTIVO</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
