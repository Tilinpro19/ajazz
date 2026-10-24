import { Section } from "../components.jsx";
import { LIGHT_EFFECTS } from "../../catalog.js";

export default function Lighting({ ctl }) {
  const mode = ctl.config.light_mode;
  return (
    <Section
      title="Iluminación"
      hint="El mouse guarda solo el efecto (no hay color configurable). El botón de luz del mouse también cambia el efecto."
    >
      <div className="light-grid">
        {LIGHT_EFFECTS.map((e) => (
          <button key={e.value} className={`light-card ${mode === e.value ? "active" : ""}`} onClick={() => mode !== e.value && ctl.applyLight(e.value)}>
            <span className={`light-preview fx-${e.value}`} />
            <span className="light-name">{e.label}</span>
            <small className="hint">{e.hint}</small>
          </button>
        ))}
      </div>
    </Section>
  );
}
