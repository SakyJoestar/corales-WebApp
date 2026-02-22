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
  setLastImageName, 
  lastImageName,
} from "./state.js";
import {
  zoomAt,
  clientToImageCoords,
  isInsideImage,
  fitToViewerCenter,
} from "./viewer.js";
import {
  renderTable,
  renderAllManualPoints,
  highlightPointByIdx,
} from "./render.js";
import {
  getBaseName,
  sanitizeName,
  idxToLabelExcel,
  getNextIdx,
} from "./helpers.js";
import { updateResetButtonState } from "./viewer.js";

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

  dom.statusEl.textContent =
    "Manual: imagen cargada. Click para agregar puntos y luego presiona Procesar.";
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
  dom.tableDiv.innerHTML = "";
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
    dom.fileCount.textContent = files.length
      ? `${files.length} archivo(s) seleccionado(s)`
      : "";

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
      setLastImageName("");
      updateNPointsState();

      clearSinglePreview();
      dom.statusEl.textContent =
        "Imágenes seleccionadas. Presiona Procesar para descargar el ZIP.";
      updateManualButtons();
      return;
    }

    // 1 imagen
    dom.batchHelp.style.display = "none";
    updateNPointsState();

    if (files.length === 1) {
      const fileObj = files[0];

      // 👇 NUEVO
      setLastImageName(fileObj.name);

      // ✅ siempre mostrar preview
      clearSinglePreview();
      loadOriginalPreview(fileObj);

      // texto UX
      dom.statusEl.textContent = dom.manualMode.checked
        ? "Manual: imagen cargada. Click para agregar puntos y luego presiona Procesar."
        : "Imagen cargada. Presiona Procesar para anotar automáticamente.";

      // Si manual está activo, habilita el panel manual (pero NO agregues puntos aquí)
      if (dom.manualMode.checked) {
        dom.manualHelp.style.display = "block";
        // aquí normalmente tu manual inicia con puntos vacíos
        setLastPoints([]);
        syncNPointsFromManual();
        renderTable(lastPoints);
        renderAllManualPoints();
      } else {
        dom.manualHelp.style.display = "none";
        // tabla vacía en modo no-manual
        dom.tableDiv.innerHTML = "";
      }

      updateManualButtons();
      return;
    }
  });
}

/* ===================== MANUAL TOGGLE ===================== */
export function bindManualToggle() {
  dom.manualMode.addEventListener("change", () => {
    const files = dom.imageFile.files ? Array.from(dom.imageFile.files) : [];

    // Manual solo tiene sentido con 1 imagen
    if (dom.manualMode.checked && files.length !== 1) {
      dom.manualMode.checked = false;
    }

    // UI de ayudas
    dom.manualHelp.style.display =
      dom.manualMode.checked && files.length === 1 ? "block" : "none";
    dom.batchHelp.style.display = files.length > 1 ? "block" : "none";
    updateNPointsState();

    // ✅ Si se desactiva manual: borrar puntos/tabla/overlays PERO mantener la imagen
    if (!dom.manualMode.checked) {
      setManualLocked(false);
      setLastPoints([]);
      syncNPointsFromManual();

      dom.tableDiv.innerHTML = "";
      dom.overlay.innerHTML = "";
      dom.overlayAll.innerHTML = "";
      setHighlightedIdx(-1);

      dom.nPointsInput.value = "100";

      // si hay 1 imagen seleccionada, mantenla en pantalla
      if (files.length === 1) {
        dom.statusEl.textContent =
          "Manual desactivado. Presiona Procesar para anotar automáticamente.";
      } else {
        // si no hay imagen, ahí sí un reset total tiene sentido
        clearSinglePreview();
        dom.statusEl.textContent = "";
      }

      updateManualButtons();
      return; // ✅ importante: evita caer al bloque que hace clearSinglePreview()
    }

    // ✅ Si se activa manual con 1 imagen: cargar modo manual
    setManualLocked(false);

    if (dom.manualMode.checked && files.length === 1) {
      loadOriginalImageForManual();
      updateManualButtons();
      return;
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

      const classes =
        AVAILABLE_CLASSES && AVAILABLE_CLASSES.length > 0
          ? AVAILABLE_CLASSES
          : [
              "Algas",
              "Coral",
              "Otros organismos",
              "Sustrato inerte",
              "Tape",
              "nan",
            ];

      lastPoints.push({
        idx: nextIdx,
        label,
        x,
        y,
        x_norm: dom.outImg.naturalWidth ? x / dom.outImg.naturalWidth : 0,
        y_norm: dom.outImg.naturalHeight ? y / dom.outImg.naturalHeight : 0,
        pred_label: classes[0] || "",
        confidence: null,
        source: "manual",
      });

      setLastPoints(lastPoints);
      syncNPointsFromManual();
      // renderTable(lastPoints);
      renderAllManualPoints();

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

    if (dom.manualMode.checked && !manualLocked) renderAllManualPoints();

    updateResetButtonState();
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
    if (files.length === 0)
      return void (dom.statusEl.textContent = "Selecciona al menos 1 imagen.");
    if (!dom.modelSelect.value)
      return void (dom.statusEl.textContent = "Selecciona un modelo.");

    const n = Number(dom.nPointsInput.value || 0);
    if (!Number.isFinite(n) || n < 1)
      return void (dom.statusEl.textContent = "N puntos debe ser >= 1.");

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
      await processSingle(fd);

      renderTable(lastPoints);

      dom.downloadImgBtn.disabled = false;
      dom.downloadXlsxBtn.disabled = false;
      setLastModelId(dom.modelSelect.value);

      if (dom.manualMode.checked) {
        setManualLocked(true);

        // ✅ limpiar marcas manuales
        dom.overlayAll.innerHTML = "";
        dom.overlay.innerHTML = "";
        setHighlightedIdx(-1);
      }

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
    downloadBase64Image(
      lastImageBase64,
      `${lastBaseName || "imagen"} (anotada).png`,
    );
  });

  dom.downloadXlsxBtn.addEventListener("click", async () => {
    if (!lastPoints || lastPoints.length === 0) return;

    try {
      const blob = await exportExcel(
        lastPoints,
        lastModelId,
        lastImageName || lastBaseName || "imagen",
      );
      downloadBlob(blob, `${lastBaseName || "imagen"} (tabla).xlsx`);
    } catch {
      alert("Error descargando Excel");
    }
  });
}

function loadOriginalPreview(fileObj) {
  // reset overlays visuales (pero NO borra puntos aquí)
  dom.overlay.innerHTML = "";
  dom.overlayAll.innerHTML = "";
  setHighlightedIdx(-1);

  const reader = new FileReader();
  reader.onload = () => {
    dom.outImg.src = reader.result; // 👈 muestra la imagen en el visor
  };
  reader.readAsDataURL(fileObj);
}
