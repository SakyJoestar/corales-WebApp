import { dom } from "./dom.js";

// Niveles de detalle del etiquetado. Regla: la categoría mayor va siempre,
// la subcategoría es opcional y el estado del coral solo si hay subcategoría.

export function getDetailLevels() {
  const subcategory = !!dom.levelSubcategory?.checked;
  return {
    subcategory,
    condition: subcategory && !!dom.levelCondition?.checked,
  };
}

function enforceDependency() {
  const hasSub = !!dom.levelSubcategory?.checked;
  if (!dom.levelCondition) return;
  dom.levelCondition.disabled = !hasSub;
  if (!hasSub) dom.levelCondition.checked = false;
}

export function setDetailLevels({ subcategory = false, condition = false } = {}) {
  if (dom.levelSubcategory) dom.levelSubcategory.checked = subcategory;
  if (dom.levelCondition) dom.levelCondition.checked = subcategory && condition;
  enforceDependency();
}

// Si el modelo de un nivel no está disponible, el nivel se puede marcar igual
// (columna para llenado manual) pero se avisa que no habrá predicción.
export function setLevelAvailability(avail = {}) {
  const hints = [
    [document.getElementById("levelSubcategoryHint"), avail.subcategory],
    [document.getElementById("levelConditionHint"), avail.condition],
  ];
  for (const [el, ok] of hints) {
    if (!el) continue;
    el.textContent = ok ? "" : "solo manual";
    el.title = ok ? "" : "No hay modelo cargado para este nivel: la columna se llena a mano";
  }
}

export function appendDetailLevels(fd) {
  const levels = getDetailLevels();
  fd.append("include_subcategory", String(levels.subcategory));
  fd.append("include_condition", String(levels.condition));
}

export function bindDetailLevels(onChange) {
  enforceDependency();
  for (const el of [dom.levelSubcategory, dom.levelCondition]) {
    el?.addEventListener("change", () => {
      enforceDependency();
      onChange?.(getDetailLevels());
    });
  }
}
