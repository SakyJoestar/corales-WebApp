import { initDom } from "./dom.js";
import { loadModels } from "./api.js";
import { bindViewerEvents } from "./viewer.js";
import {
  bindFormEvents,
  bindDownloadEvents,
  bindFileEvents,
  bindManualToggle,
  bindViewerClickEvents,
  bindManualDeleteButtons,
} from "./manual.js";
import { updateNPointsState, clearSinglePreview, updateManualButtons } from "./state.js";
import { updateResetButtonState } from "./viewer.js";

window.addEventListener("DOMContentLoaded", async () => {
  initDom();

  updateResetButtonState();

  updateNPointsState();
  clearSinglePreview();

  await loadModels();

  bindViewerEvents();           // pan/zoom + reset
  bindViewerClickEvents();      // click zoom o manual add
  bindFileEvents();
  bindManualToggle();
  bindManualDeleteButtons();    // delete last/all
  bindFormEvents();
  bindDownloadEvents();

  updateManualButtons();
});