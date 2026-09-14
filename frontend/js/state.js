import { dom } from "./dom.js";
import { renderTable } from "./render.js";

export let AVAILABLE_CLASSES = [];
export let manualLocked = false;

export let lastImageBase64 = "";
export let lastPoints = [];
export let lastModelId = "";
export let lastBaseName = "";
export let lastImageName = "";
export let highlightedIdx = -1;

// pan/zoom
export let scale = 1;
export let offsetX = 0;
export let offsetY = 0;

export let cropModeActive = false;
export function setCropModeActive(v) { cropModeActive = !!v; }

export let lastDownloadToken = "";

// historial de resultados (solo en memoria, dura la sesión del navegador)
export let resultHistory = [];
const MAX_HISTORY = 20;

export function addHistoryEntry(entry) {
  resultHistory = [entry, ...resultHistory].slice(0, MAX_HISTORY);
}

export function removeHistoryEntry(id) {
  resultHistory = resultHistory.filter((e) => e.id !== id);
}

export function clearHistory() {
  resultHistory = [];
}

// mutadores mínimos (para que no sea un “spaghetti”)
export function setAvailableClasses(arr) { AVAILABLE_CLASSES = arr || []; }
export function setManualLocked(v) { manualLocked = !!v; }
export function setLastPoints(arr) { lastPoints = Array.isArray(arr) ? arr : []; }
export function setLastImageBase64(v) { lastImageBase64 = v || ""; }
export function setLastModelId(v) { lastModelId = v || ""; }
export function setLastBaseName(v) { lastBaseName = v || ""; }
export function setLastImageName(v) { lastImageName = v || ""; }
export function setHighlightedIdx(v) { highlightedIdx = Number.isFinite(v) ? v : -1; }

export function setTransform(s, x, y) {
  scale = s; offsetX = x; offsetY = y;
}

export function updateNPointsState() {
  dom.nPointsInput.disabled = dom.manualMode.checked;
  dom.nPointsInput.style.background = dom.manualMode.checked ? "#eee" : "";
  dom.nPointsInput.style.cursor = dom.manualMode.checked ? "not-allowed" : "";
}

export function updateModeTabsUI() {
  const files = dom.imageFile.files ? Array.from(dom.imageFile.files) : [];
  const manualAllowed = files.length === 1;
  const isManual = dom.manualMode.checked;

  dom.configSection.style.display = files.length > 0 ? "" : "none";

  dom.tabManual.disabled = !manualAllowed;
  dom.tabAuto.classList.toggle("is-active", !isManual);
  dom.tabManual.classList.toggle("is-active", isManual);
  dom.tabAuto.setAttribute("aria-selected", String(!isManual));
  dom.tabManual.setAttribute("aria-selected", String(isManual));

  dom.nPointsField.style.display = isManual ? "none" : "";
}

export function syncNPointsFromManual() {
  dom.nPointsInput.value = String(lastPoints.length);
}

const DOWNLOAD_DISABLED_HINT = "Procesa una imagen primero";

export function setDownloadImgEnabled(v) {
  dom.downloadImgBtn.disabled = !v;
  dom.downloadImgBtn.title = v ? "" : DOWNLOAD_DISABLED_HINT;
}

export function setDownloadXlsxEnabled(v) {
  dom.downloadXlsxBtn.disabled = !v;
  dom.downloadXlsxBtn.title = v ? "" : DOWNLOAD_DISABLED_HINT;
}

export function clearSinglePreview() {
  dom.outImg.src = "";
  dom.overlay.innerHTML = "";
  dom.overlayAll.innerHTML = "";
  renderTable([]);
  setDownloadImgEnabled(false);
  setDownloadXlsxEnabled(false);
  setHighlightedIdx(-1);
}

export function updateManualButtons() {
  const enabled = dom.manualMode.checked && !manualLocked && lastPoints.length > 0;
  dom.deleteLastBtn.disabled = !enabled;
  dom.deleteAllBtn.disabled = !enabled;
  dom.cropBtn.disabled = !dom.outImg.src;
}

export function setLastDownloadToken(v) {
  lastDownloadToken = v || "";
}