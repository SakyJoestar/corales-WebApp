import { dom, initDom } from "./dom.js";
import { loadModels } from "./api.js";
import { bindViewerEvents } from "./viewer.js";
import {
  bindFormEvents,
  bindDownloadEvents,
  bindFileEvents,
  bindManualToggle,
  bindModeTabs,
  bindViewerClickEvents,
  bindManualDeleteButtons,
  bindDropzone,
} from "./manual.js";
import { updateNPointsState, updateModeTabsUI, clearSinglePreview, updateManualButtons } from "./state.js";
import { updateResetButtonState, zoomAtCenter, fitToViewerCenter } from "./viewer.js";
import { initTheme, bindThemeToggle } from "./theme.js";
import { renderLegend } from "./render.js";
import { renderHistory, bindHistoryModal } from "./history.js";
import { bindCropButton } from "./crop.js";

initTheme();

window.addEventListener("DOMContentLoaded", async () => {
  initDom();

  // los modelos se cargan primero: nada más abajo debe poder bloquearlos
  try {
    await loadModels();
  } catch (err) {
    console.error("No se pudieron cargar los modelos:", err);
  }
  renderLegend();

  if (dom.themeToggleBtn) bindThemeToggle(dom.themeToggleBtn);

  updateResetButtonState();
  updateNPointsState();
  updateModeTabsUI();
  clearSinglePreview();
  renderHistory();
  bindHistoryModal();

  bindDropzone();
  bindViewerEvents();           // pan/zoom + reset
  bindViewerClickEvents();      // click zoom o manual add
  bindFileEvents();
  bindManualToggle();
  bindModeTabs();
  bindManualDeleteButtons();    // delete last/all
  bindCropButton();
  bindFormEvents();
  bindDownloadEvents();

  if (dom.zoomInBtn) dom.zoomInBtn.addEventListener("click", () => zoomAtCenter(1.25));
  if (dom.zoomOutBtn) dom.zoomOutBtn.addEventListener("click", () => zoomAtCenter(1 / 1.25));
  if (dom.zoomResetBtn) dom.zoomResetBtn.addEventListener("click", () => fitToViewerCenter());

  updateManualButtons();
});