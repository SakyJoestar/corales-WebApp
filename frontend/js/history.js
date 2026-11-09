import { dom } from "./dom.js";
import {
  resultHistory,
  addHistoryEntry,
  removeHistoryEntry,
  clearHistory,
  setHistory,
  MAX_HISTORY,
  lastPoints,
  lastImageBase64,
  setLastPoints,
  setLastImageBase64,
  setLastModelId,
  setLastBaseName,
  setLastImageName,
  setHighlightedIdx,
  setLastDownloadToken,
  setManualLocked,
  updateManualButtons,
  setDownloadImgEnabled,
  setDownloadXlsxEnabled,
  updateModeTabsUI,
  setImageProcessed,
} from "./state.js";
import { renderTable } from "./render.js";
import { collapseSidebar } from "./sidebar.js";
import { setDetailLevels } from "./levels.js";
import { setBaseImageSrc } from "./focus.js";
import { loadAllEntries, putEntry, deleteEntry, clearEntries, storeAvailable } from "./historyStore.js";

// entrada que se está viendo: las ediciones de la tabla (clase, subclase,
// estado, notas, borrar puntos) se guardan en ella
let currentHistoryId = "";
let persistent = false;

function formatDate(iso) {
  const dt = new Date(iso);
  const day = dt.toLocaleDateString("es", { day: "2-digit", month: "short" });
  const time = dt.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

const TRASH_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"></path><path d="M10 11v6M14 11v6"></path></svg>`;

function persist(entry) {
  if (!persistent) return;
  putEntry(entry, resultHistory).then((evicted) => {
    if (!evicted.length) return;
    evicted.forEach((id) => removeHistoryEntry(id));
    renderHistory();
    dom.statusEl.textContent =
      `El navegador no tenía espacio: se borraron ${evicted.length} resultado(s) antiguos del historial.`;
  });
}

export async function initHistory() {
  persistent = await storeAvailable();
  if (persistent) setHistory(await loadAllEntries());
  renderHistory();
  if (dom.historyStorageNote) {
    dom.historyStorageNote.textContent = persistent
      ? "Se guarda en este navegador. Exporta para respaldarlo o llevarlo a otro equipo."
      : "Este navegador no permite guardar datos: el historial se pierde al recargar. Exporta para conservarlo.";
  }
}

export function recordHistoryEntry({ imageBase64, baseName, imageName, modelId, modelName, points, downloadToken, levels, originalSrc }) {
  if (!imageBase64) return;

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    imageBase64,
    baseName: baseName || "",
    imageName: imageName || "",
    modelId: modelId || "",
    modelName: modelName || modelId || "",
    points: JSON.parse(JSON.stringify(points || [])),
    downloadToken: downloadToken || "",
    levels: levels || null,
    originalSrc: originalSrc || "",
    date: new Date().toISOString(),
  };
  const dropped = addHistoryEntry(entry);
  currentHistoryId = entry.id;

  persist(entry);
  if (persistent) dropped.forEach((e) => deleteEntry(e.id));
  renderHistory();
}

// Copia los puntos actuales (con notas y correcciones) a la entrada abierta.
let syncTimer = null;
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const entry = resultHistory.find((e) => e.id === currentHistoryId);
    // solo si el visor sigue mostrando esa entrada
    if (!entry || entry.imageBase64 !== lastImageBase64) return;
    const next = JSON.stringify(lastPoints || []);
    if (next === JSON.stringify(entry.points)) return;
    entry.points = JSON.parse(next);
    entry.updated = new Date().toISOString();
    persist(entry);
    renderHistory();
  }, 400);
}

export function bindHistorySync() {
  if (!dom.tableDiv) return;
  // en burbuja: corre después de los manejadores de la tabla, que ya actualizaron lastPoints
  dom.tableDiv.addEventListener("input", scheduleSync);
  dom.tableDiv.addEventListener("change", scheduleSync);
  dom.tableDiv.addEventListener("click", scheduleSync);
}

export function renderHistory() {
  if (dom.historyCount) dom.historyCount.textContent = String(resultHistory.length);
  if (dom.clearHistoryBtn) dom.clearHistoryBtn.disabled = resultHistory.length === 0;
  if (dom.exportHistoryBtn) dom.exportHistoryBtn.disabled = resultHistory.length === 0;
  if (!dom.historyList) return;

  if (!resultHistory.length) {
    dom.historyList.innerHTML = `<div class="help-text history-empty">Aún no hay resultados guardados.</div>`;
    return;
  }

  dom.historyList.innerHTML = resultHistory
    .map(
      (entry, i) => `
    <div class="history-item" data-hidx="${i}" role="button" tabindex="0">
      <img class="history-thumb" src="data:image/png;base64,${entry.imageBase64}" alt="" />
      <span class="history-meta">
        <span class="history-name">${escapeHtml(entry.imageName || entry.baseName || "imagen")}</span>
        <span class="history-sub">${formatDate(entry.date)}${entry.modelName ? ` · ${escapeHtml(entry.modelName)}` : ""} · ${entry.points.length} pts${notesLabel(countNotes(entry))}</span>
      </span>
      <button type="button" class="history-item-delete" title="Quitar del historial" aria-label="Quitar del historial">${TRASH_ICON}</button>
    </div>`
    )
    .join("");

  const loadEntryAt = (i) => {
    const entry = resultHistory[i];
    if (entry) loadHistoryEntry(entry);
    closeHistoryModal();
  };

  dom.historyList.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", () => loadEntryAt(Number(item.dataset.hidx)));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        loadEntryAt(Number(item.dataset.hidx));
      }
    });
  });

  dom.historyList.querySelectorAll(".history-item-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const item = btn.closest(".history-item");
      const entry = resultHistory[Number(item.dataset.hidx)];
      if (entry) {
        removeHistoryEntry(entry.id);
        if (persistent) deleteEntry(entry.id);
        if (entry.id === currentHistoryId) currentHistoryId = "";
        renderHistory();
      }
    });
  });
}

/* ===================== MODAL ===================== */
export function openHistoryModal() {
  if (!dom.historyModal) return;
  dom.historyModal.hidden = false;
}

export function closeHistoryModal() {
  if (!dom.historyModal) return;
  dom.historyModal.hidden = true;
}

export function bindHistoryModal() {
  if (dom.historyBtn) dom.historyBtn.addEventListener("click", openHistoryModal);
  if (dom.historyModalCloseBtn) dom.historyModalCloseBtn.addEventListener("click", closeHistoryModal);

  if (dom.clearHistoryBtn) {
    dom.clearHistoryBtn.addEventListener("click", () => {
      if (!resultHistory.length) return;
      if (!confirm("¿Eliminar todo el historial guardado en este navegador? Si no lo exportaste, no se puede recuperar.")) return;
      clearHistory();
      currentHistoryId = "";
      if (persistent) clearEntries();
      renderHistory();
    });
  }

  if (dom.exportHistoryBtn) dom.exportHistoryBtn.addEventListener("click", exportHistory);
  if (dom.importHistoryBtn && dom.importHistoryInput) {
    dom.importHistoryBtn.addEventListener("click", () => dom.importHistoryInput.click());
    dom.importHistoryInput.addEventListener("change", async () => {
      const file = dom.importHistoryInput.files?.[0];
      dom.importHistoryInput.value = "";
      if (file) await importHistory(file);
    });
  }

  if (dom.historyModal) {
    dom.historyModal.addEventListener("click", (e) => {
      if (e.target === dom.historyModal) closeHistoryModal();
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dom.historyModal && !dom.historyModal.hidden) {
      closeHistoryModal();
    }
  });
}

function countNotes(entry) {
  return (entry.points || []).filter((p) => p && String(p.note || "").trim()).length;
}

function notesLabel(n) {
  return n ? ` · ${n} ${n === 1 ? "nota" : "notas"}` : "";
}

/* ===================== EXPORTAR / IMPORTAR ===================== */
const EXPORT_FORMAT = "coralgorgona-historial";

function exportHistory() {
  if (!resultHistory.length) return;
  const payload = {
    format: EXPORT_FORMAT,
    version: 1,
    exported: new Date().toISOString(),
    // el token de descarga vive en la memoria del servidor: no sirve fuera de esta sesión
    entries: resultHistory.map(({ downloadToken, ...rest }) => rest),
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `coralgorgona_historial_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;

// Solo acepta lo que la app sabe mostrar; todo lo demás se descarta.
function sanitizeEntry(e) {
  if (!e || typeof e !== "object") return null;
  if (typeof e.imageBase64 !== "string" || !BASE64_RE.test(e.imageBase64)) return null;
  if (!Array.isArray(e.points)) return null;
  const str = (v) => (typeof v === "string" ? v : "");
  const date = new Date(e.date);
  const originalSrc = /^data:image\/(png|jpe?g|webp|gif|bmp);base64,/.test(str(e.originalSrc)) ? e.originalSrc : "";
  const levels =
    e.levels && typeof e.levels === "object"
      ? { subcategory: !!e.levels.subcategory, condition: !!e.levels.condition }
      : null;
  return {
    id: str(e.id) || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    imageBase64: e.imageBase64,
    baseName: str(e.baseName),
    imageName: str(e.imageName),
    modelId: str(e.modelId),
    modelName: str(e.modelName) || str(e.modelId),
    points: e.points.filter((p) => p && typeof p === "object" && Number.isFinite(p.x) && Number.isFinite(p.y)),
    downloadToken: "",
    levels,
    originalSrc,
    date: isNaN(date) ? new Date().toISOString() : date.toISOString(),
    ...(e.updated ? { updated: str(e.updated) } : {}),
  };
}

async function importHistory(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    alert("El archivo no es un historial válido (no se pudo leer como JSON).");
    return;
  }
  if (!data || data.format !== EXPORT_FORMAT || !Array.isArray(data.entries)) {
    alert("El archivo no es un historial exportado desde CoralGorgona.");
    return;
  }

  const existing = new Set(resultHistory.map((e) => e.id));
  const incoming = data.entries.map(sanitizeEntry).filter(Boolean);
  const fresh = incoming.filter((e) => !existing.has(e.id));
  const skipped = data.entries.length - incoming.length;
  const dup = incoming.length - fresh.length;

  if (!fresh.length) {
    alert(dup ? "Todas las entradas del archivo ya estaban en el historial." : "El archivo no tiene entradas válidas.");
    return;
  }

  const merged = [...fresh, ...resultHistory].sort((a, b) => b.date.localeCompare(a.date));
  const kept = merged.slice(0, MAX_HISTORY);
  const keptIds = new Set(kept.map((e) => e.id));
  setHistory(kept);
  if (persistent) {
    for (const e of fresh) if (keptIds.has(e.id)) await putEntry(e, []);
    for (const e of merged.slice(MAX_HISTORY)) if (existing.has(e.id)) await deleteEntry(e.id);
  }
  renderHistory();

  const added = fresh.filter((e) => keptIds.has(e.id)).length;
  const parts = [`Se importaron ${added} resultado(s).`];
  if (dup) parts.push(`${dup} ya estaban.`);
  if (skipped) parts.push(`${skipped} no eran válidos y se omitieron.`);
  if (merged.length > MAX_HISTORY) parts.push(`El historial guarda hasta ${MAX_HISTORY}: se quitaron los más antiguos.`);
  dom.statusEl.textContent = parts.join(" ");
}

function loadHistoryEntry(entry) {
  currentHistoryId = entry.id;
  dom.manualMode.checked = false;
  dom.manualHelp.style.display = "none";
  dom.batchHelp.style.display = "none";
  updateModeTabsUI();
  setManualLocked(false);

  setLastImageBase64(entry.imageBase64);
  setLastModelId(entry.modelId);
  setLastBaseName(entry.baseName);
  setLastImageName(entry.imageName);
  setLastPoints(JSON.parse(JSON.stringify(entry.points)));
  setHighlightedIdx(-1);
  setLastDownloadToken(entry.downloadToken);

  setBaseImageSrc(entry.originalSrc);
  dom.outImg.src = "data:image/png;base64," + entry.imageBase64;
  setImageProcessed(true);
  dom.overlay.innerHTML = "";
  dom.overlayAll.innerHTML = "";

  // entradas viejas no tienen niveles: se dejan los checks como están
  if (entry.levels) setDetailLevels(entry.levels);
  renderTable(entry.points);

  setDownloadImgEnabled(!!(entry.imageBase64 || entry.downloadToken));
  setDownloadXlsxEnabled(entry.points.length > 0);

  dom.statusEl.textContent = `Cargado desde historial: ${entry.imageName || entry.baseName}`;
  updateManualButtons();
  collapseSidebar();
}
