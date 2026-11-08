export const CLASS_COLOR_HEX = {
  "Algas": "#1baf7a",
  "Coral": "#eb6834",
  "Otros organismos": "#4a3aa7",
  "No identificado u otros": "#4a3aa7",
  "Sustrato inerte": "#2a78d6",
  "Tape": "#c9972e",
  "nan": "#8f8073",
};

const CLASS_COLOR_VAR = {
  "Algas": "var(--c-algas)",
  "Coral": "var(--c-coral)",
  "Otros organismos": "var(--c-otros)",
  "No identificado u otros": "var(--c-otros)",
  "Sustrato inerte": "var(--c-sustrato)",
  "Tape": "var(--c-tape)",
  "nan": "var(--c-nan)",
};

// Condición de salud (solo Coral). Códigos de cobertura_codes_v3 (sección notas),
// los mismos que usan las anotaciones originales en la columna Notes.
export const CORAL_CONDITIONS = [
  { code: "SANO", label: "Sano", color: "var(--cond-sano)" },
  { code: "BLAN", label: "Blanqueado", color: "var(--cond-blan)" },
  { code: "DCOR", label: "Recién muerto", color: "var(--cond-dcor)" },
  { code: "FLUO", label: "Fluorescencia", color: "var(--cond-fluo)" },
  { code: "SICK", label: "Enfermo", color: "var(--cond-sick)" },
  { code: "OTRO", label: "Otro", color: "var(--text-tertiary)" },
];

export const CONDITION_CLASS = "Coral";

export function conditionColorVar(code) {
  return CORAL_CONDITIONS.find((c) => c.code === code)?.color || "transparent";
}

export function classColorVar(name) {
  return CLASS_COLOR_VAR[name] || "var(--text-tertiary)";
}

export function classDisplayLabel(name) {
  return name === "nan" ? "Sin clasificar" : name;
}
