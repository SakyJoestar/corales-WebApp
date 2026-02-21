import { dom } from "./dom.js";
import { processSingle, processBatch, exportExcel } from "./api.js";
import {
  AVAILABLE_CLASSES,
  manualLocked,
  lastPoints,
  lastImageBase64,
  lastModelId,
  lastBaseName,
  setManualLocked,
  setLastBaseName,
  setLastModelId,
  setLastImageBase64,
  setLastPoints,
  setHighlightedIdx,
  clearSinglePreview,
  updateNPointsState,
  syncNPointsFromManual,
  updateManualButtons,
} from "./state.js";
import { zoomAt, clientToImageCoords, isInsideImage, fitToViewerCenter } from "./viewer.js";
import { renderTable, renderAllManualPoints, highlightPointByIdx } from "./render.js";
import { getBaseName, sanitizeName, idxToLabelExcel, getNextIdx } from "./helpers.js";

/* ===== descargas ===== */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadBase64Image(base64Png, filename) {
  const a = document.createElement("a");
  a.href = "data:image/png;base64," + base64Png;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ===== manual preview (cargar original sin puntos) ===== */
function loadOriginalImageForManual() {
  const files = dom.imageFile.files;
  if (!files || files.length !== 1) return;

  const fileObj = files[0];
  setManualLocked(false);

  dom.statusEl.textContent = "Manual: imagen cargada. Click para agregar puntos y luego presiona Procesar.";
  dom.downloadImgBtn.disabled = true;
  dom.downloadXlsxBtn.disabled = true;

  setLastImageBase64("");
  setLastModelId(dom.modelSelect.value || "");
  setLastBaseName(sanitizeName(getBaseName(fileObj.name)));

  setLastPoints([]);
  syncNPointsFromManual();
  renderTable(lastPoints);

  dom.overlay.innerHTML = "";
  dom.overlayAll.innerHTML = "";
  setHighlightedIdx(-1);

  const reader = new FileReader();
  reader.onload = () => {
    dom.outImg.src = reader.result;
  };
  reader.readAsDataURL(fileObj);

  updateManualButtons();
}

/* ===================== FILE EVENTS ===================== */
export function bindFileEvents() {
  dom.imageFile.addEventListener("change", () => {
    const files = dom.imageFile.files ? Array.from(dom.imageFile.files) : [];
    dom.fileCount.textContent = files.length ? `${files.length} archivo(s) seleccionado(s)` : "";

    // reset base
    setManualLocked(false);

    // Validación simple
    if (files.length > 25) {
      dom.statusEl.textContent = "Error: Máximo 25 imágenes.";
      dom.imageFile.value = "";
      dom.fileCount.textContent = "";
      clearSinglePreview();
      dom.manualMode.checked = false;
      dom.manualHelp.style.display = "none";
      dom.batchHelp.style.display = "none";
      updateNPointsState();
      updateManualButtons();
      return;
    }

    // BATCH
    if (files.length > 1) {
      dom.manualMode.checked = false;
      dom.manualHelp.style.display = "none";
      dom.batchHelp.style.display = "block";
      updateNPointsState();

      clearSinglePreview();
      dom.statusEl.textContent = "Imágenes seleccionadas. Presiona Procesar para descargar el ZIP.";
      updateManualButtons();
      return;
    }

    // 1 imagen
    dom.batchHelp.style.display = "none";
    updateNPointsState();

    if (!dom.manualMode.checked) {
      clearSinglePreview();
      dom.statusEl.textContent = files.length === 1 ? "Imagen seleccionada. Presiona Procesar." : "";
      updateManualButtons();
      return;
    }

    // manual con 1 imagen => mostrar original
    if (files.length === 1) {
      dom.manualHelp.style.display = "block";
      loadOriginalImageForManual();
    }
  });
}

/* ===================== MANUAL TOGGLE ===================== */
export function bindManualToggle() {
  dom.manualMode.addEventListener("change", () => {
    const files = dom.imageFile.files ? Array.from(dom.imageFile.files) : [];

    if (dom.manualMode.checked && files.length !== 1) {
      dom.manualMode.checked = false;
    }

    dom.manualHelp.style.display = (dom.manualMode.checked && files.length === 1) ? "block" : "none";
    dom.batchHelp.style.display = (files.length > 1) ? "block" : "none";
    updateNPointsState();

    setManualLocked(false);

    if (dom.manualMode.checked && files.length === 1) {
      loadOriginalImageForManual();
    } else {
      if (files.length === 1) {
        clearSinglePreview();
        dom.statusEl.textContent = "Imagen seleccionada. Presiona Procesar.";
      }
    }

    updateManualButtons();
  });
}

/* ===================== VIEWER CLICK: manual add / normal zoom ===================== */
export function bindViewerClickEvents() {
  dom.viewer.addEventListener("click", (e) => {
    if (!dom.outImg.src) return;

    // manual add
    if (dom.manualMode.checked) {
      if (manualLocked) return;
      if (e.button !== 0) return;

      const { x, y } = clientToImageCoords(e.clientX, e.clientY);
      if (!isInsideImage(x, y)) return;

      const nextIdx = getNextIdx(lastPoints);
      const label = idxToLabelExcel(nextIdx);

      const classes = (AVAILABLE_CLASSES && AVAILABLE_CLASSES.length > 0)
        ? AVAILABLE_CLASSES
        : ["Algas","Coral","Otros organismos","Sustrato inerte","Tape","nan"];

      lastPoints.push({
        idx: nextIdx,
        label,
        x, y,
        x_norm: dom.outImg.naturalWidth ? x / dom.outImg.naturalWidth : 0,
        y_norm: dom.outImg.naturalHeight ? y / dom.outImg.naturalHeight : 0,
        pred_label: classes[0] || "",
        confidence: null,
        source: "manual",
      });

      setLastPoints(lastPoints);
      syncNPointsFromManual();
      renderTable(lastPoints);
      renderAllManualPoints();
      highlightPointByIdx(lastPoints.length - 1);

      dom.statusEl.textContent = `Manual: puntos = ${lastPoints.length}. Presiona Procesar cuando termines.`;
      updateManualButtons();
      return;
    }

    // normal zoom
    const factor = e.shiftKey ? 1 / 1.25 : 1.25;
    zoomAt(e.clientX, e.clientY, factor);
  });

  // overlays size + fit on load
  dom.outImg.onload = () => {
    fitToViewerCenter();

    dom.overlay.style.width = dom.outImg.naturalWidth + "px";
    dom.overlay.style.height = dom.outImg.naturalHeight + "px";
    dom.overlayAll.style.width = dom.outImg.naturalWidth + "px";
    dom.overlayAll.style.height = dom.outImg.naturalHeight + "px";

    dom.overlay.innerHTML = "";
    setHighlightedIdx(-1);

    if (dom.manualMode.checked) renderAllManualPoints();
  };

  window.addEventListener("resize", () => {
    if (dom.outImg.src) fitToViewerCenter();
  });
}

/* ===================== MANUAL DELETE BUTTONS ===================== */
export function bindManualDeleteButtons() {
  dom.deleteLastBtn.addEventListener("click", () => {
    if (!dom.manualMode.checked || manualLocked) return;
    if (lastPoints.length === 0) return;

    lastPoints.pop();
    setLastPoints(lastPoints);

    syncNPointsFromManual();
    renderTable(lastPoints);
    renderAllManualPoints();
    updateManualButtons();

    dom.statusEl.textContent = `Manual: puntos = ${lastPoints.length}`;
  });

  dom.deleteAllBtn.addEventListener("click", () => {
    if (!dom.manualMode.checked || manualLocked) return;
    if (lastPoints.length === 0) return;

    setLastPoints([]);
    dom.overlay.innerHTML = "";
    dom.overlayAll.innerHTML = "";
    setHighlightedIdx(-1);

    syncNPointsFromManual();
    renderTable([]);
    updateManualButtons();

    dom.statusEl.textContent = "Manual: todos los puntos eliminados.";
  });
}

/* ===================== SUBMIT ===================== */
export function bindFormEvents() {
  dom.imageForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const files = dom.imageFile.files ? Array.from(dom.imageFile.files) : [];
    if (files.length === 0) return void (dom.statusEl.textContent = "Selecciona al menos 1 imagen.");
    if (!dom.modelSelect.value) return void (dom.statusEl.textContent = "Selecciona un modelo.");

    const n = Number(dom.nPointsInput.value || 0);
    if (!Number.isFinite(n) || n < 1) return void (dom.statusEl.textContent = "N puntos debe ser >= 1.");

    // ====== BATCH ======
    if (files.length > 1) {
      dom.statusEl.textContent = `Procesando ${files.length} imágenes... (esto puede tardar)`;
      clearSinglePreview();

      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      fd.append("n", String(n));
      fd.append("model_id", dom.modelSelect.value);

      try {
        const blob = await processBatch(fd);
        downloadBlob(blob, "resultados_coral.zip");
        dom.statusEl.textContent = "Listo ✅ ZIP descargado.";
      } catch (err) {
        dom.statusEl.textContent = "Error: " + (err?.message || "batch");
      }
      return;
    }

    // ====== SINGLE ======
    const fileObj = files[0];
    const baseName = sanitizeName(getBaseName(fileObj.name));
    setLastBaseName(baseName);

    const fd = new FormData();
    fd.append("file", fileObj);

    if (dom.manualMode.checked) {
      syncNPointsFromManual();
      fd.append("n", String(lastPoints.length));
      fd.append("points_json", JSON.stringify(lastPoints));
    } else {
      fd.append("n", String(n));
    }

    fd.append("model_id", dom.modelSelect.value);

    dom.statusEl.textContent = "Procesando imagen...";
    dom.downloadImgBtn.disabled = true;
    dom.downloadXlsxBtn.disabled = true;

    try {
      const data = await processSingle(fd);

      // actualizar render
      renderTable(lastPoints);

      dom.downloadImgBtn.disabled = false;
      dom.downloadXlsxBtn.disabled = false;
      setLastModelId(dom.modelSelect.value);

      if (dom.manualMode.checked) setManualLocked(true);
      updateManualButtons();

      dom.statusEl.textContent = "Listo ✅";
    } catch (err) {
      dom.statusEl.textContent = "Error: " + (err?.message || "process");
    }
  });
}

/* ===================== DOWNLOADS ===================== */
export function bindDownloadEvents() {
  dom.downloadImgBtn.addEventListener("click", () => {
    if (!lastImageBase64) return;
    downloadBase64Image(lastImageBase64, `${lastBaseName || "imagen"} (anotada).png`);
  });

  dom.downloadXlsxBtn.addEventListener("click", async () => {
    if (!lastPoints || lastPoints.length === 0) return;

    try {
      const blob = await exportExcel(lastPoints, lastModelId);
      downloadBlob(blob, `${lastBaseName || "imagen"} (tabla).xlsx`);
    } catch {
      alert("Error descargando Excel");
    }
  });
}