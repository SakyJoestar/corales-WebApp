export const CLASS_COLOR_HEX = {
  "Algas": "#1baf7a",
  "Coral": "#eb6834",
  "Otros organismos": "#4a3aa7",
  "Sustrato inerte": "#2a78d6",
  "Tape": "#c9972e",
  "nan": "#8f8073",
};

const CLASS_COLOR_VAR = {
  "Algas": "var(--c-algas)",
  "Coral": "var(--c-coral)",
  "Otros organismos": "var(--c-otros)",
  "Sustrato inerte": "var(--c-sustrato)",
  "Tape": "var(--c-tape)",
  "nan": "var(--c-nan)",
};

export function classColorVar(name) {
  return CLASS_COLOR_VAR[name] || "var(--text-tertiary)";
}

export function classDisplayLabel(name) {
  return name === "nan" ? "Sin clasificar" : name;
}
