import { dom } from "./dom.js";
import {
  resultHistory,
  addHistoryEntry,
  removeHistoryEntry,
  clearHistory,
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
} from "./state.js";
import { renderTable } from "./render.js";

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

export function recordHistoryEntry({ imageBase64, baseName, imageName, modelId, modelName, points, downloadToken }) {
  if (!imageBase64) return;

  addHistoryEntry({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    imageBase64,
    baseName: baseName || "",
    imageName: imageName || "",
    modelId: modelId || "",
    modelName: modelName || modelId || "",
    points: JSON.parse(JSON.stringify(points || [])),
    downloadToken: downloadToken || "",
    date: new Date().toISOString(),
  });

  renderHistory();
}

export function renderHistory() {
  if (dom.historyCount) dom.historyCount.textContent = String(resultHistory.length);
  if (dom.clearHistoryBtn) dom.clearHistoryBtn.disabled = resultHistory.length === 0;
  if (!dom.historyList) return;

  if (!resultHistory.length) {
    dom.historyList.innerHTML = `<div class="help-text history-empty">Aún no hay resultados en esta sesión.</div>`;
    return;
  }

  dom.historyList.innerHTML = resultHistory
    .map(
      (entry, i) => `
    <div class="history-item" data-hidx="${i}" role="button" tabindex="0">
      <img class="history-thumb" src="data:image/png;base64,${entry.imageBase64}" alt="" />
      <span class="history-meta">
        <span class="history-name">${escapeHtml(entry.imageName || entry.baseName || "imagen")}</span>
        <span class="history-sub">${formatDate(entry.date)} · ${escapeHtml(entry.modelName)} · ${entry.points.length} pts</span>
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
      if (!confirm("¿Eliminar todo el historial de esta sesión?")) return;
      clearHistory();
      renderHistory();
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

function loadHistoryEntry(entry) {
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

  dom.outImg.src = "data:image/png;base64," + entry.imageBase64;
  dom.overlay.innerHTML = "";
  dom.overlayAll.innerHTML = "";

  renderTable(entry.points);

  setDownloadImgEnabled(!!entry.downloadToken);
  setDownloadXlsxEnabled(entry.points.length > 0);

  dom.statusEl.textContent = `Cargado desde historial: ${entry.imageName || entry.baseName}`;
  updateManualButtons();
}
