import { dom } from "./dom.js";

export let AVAILABLE_CLASSES = [];
export let manualLocked = false;

export let lastImageBase64 = "";
export let lastPoints = [];
export let lastModelId = "";
export let lastBaseName = "";
export let highlightedIdx = -1;

// pan/zoom
export let scale = 1;
export let offsetX = 0;
export let offsetY = 0;

// mutadores mínimos (para que no sea un “spaghetti”)
export function setAvailableClasses(arr) { AVAILABLE_CLASSES = arr || []; }
export function setManualLocked(v) { manualLocked = !!v; }
export function setLastPoints(arr) { lastPoints = Array.isArray(arr) ? arr : []; }
export function setLastImageBase64(v) { lastImageBase64 = v || ""; }
export function setLastModelId(v) { lastModelId = v || ""; }
export function setLastBaseName(v) { lastBaseName = v || ""; }
export function setHighlightedIdx(v) { highlightedIdx = Number.isFinite(v) ? v : -1; }

export function setTransform(s, x, y) {
  scale = s; offsetX = x; offsetY = y;
}

export function updateNPointsState() {
  dom.nPointsInput.disabled = dom.manualMode.checked;
  dom.nPointsInput.style.background = dom.manualMode.checked ? "#eee" : "";
  dom.nPointsInput.style.cursor = dom.manualMode.checked ? "not-allowed" : "";
}

export function syncNPointsFromManual() {
  dom.nPointsInput.value = String(lastPoints.length);
}

export function clearSinglePreview() {
  dom.outImg.src = "";
  dom.overlay.innerHTML = "";
  dom.overlayAll.innerHTML = "";
  dom.tableDiv.innerHTML = "";
  dom.downloadImgBtn.disabled = true;
  dom.downloadXlsxBtn.disabled = true;
  setHighlightedIdx(-1);
}

export function updateManualButtons() {
  const enabled = dom.manualMode.checked && !manualLocked && lastPoints.length > 0;
  dom.deleteLastBtn.disabled = !enabled;
  dom.deleteAllBtn.disabled = !enabled;
}