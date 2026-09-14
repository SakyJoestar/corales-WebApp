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
  lastDownloadToken,
  setDownloadImgEnabled,
  setDownloadXlsxEnabled,
  updateModeTabsUI,
  cropModeActive,
} from "./state.js";
import { recordHistoryEntry } from "./history.js";
import {
  clientToImageCoords,
  isInsideImage,
  fitToViewerCenter,
  wasLastDragASignificantMove,
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
  if (!base64Png) return;

  // si viene con data:image..., extrae solo el base64
  const pureBase64 = base64Png.includes("base64,")
    ? base64Png.split("base64,")[1]
    : base64Png;

  const bytes = Uint8Array.from(atob(pureBase64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "image/png" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename || "imagen_anotada.png";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

/* ===== manual preview (cargar original sin puntos) ===== */
function loadOriginalImageForManual() {
  const files = dom.imageFile.files;
  if (!files || files.length !== 1) return;

  const fileObj = files[0];
  setManualLocked(false);

  dom.statusEl.textContent =
    "Manual: imagen cargada. Click para agregar puntos y luego presiona Procesar.";
  setDownloadImgEnabled(false);
  setDownloadXlsxEnabled(false);

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

/* ===================== DROPZONE (drag & drop + click) ===================== */
export function bindDropzone() {
  const zone = dom.dropzone;
  const input = dom.imageFile;
  if (!zone || !input) return;

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });

  ["dragenter", "dragover"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add("dragging");
    });
  });

  ["dragleave", "dragend"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.remove("dragging");
    });
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("dragging");

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    input.files = files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/* ===================== CHIPS DE ARCHIVOS SELECCIONADOS ===================== */
function removeFileAt(index) {
  const files = dom.imageFile.files ? Array.from(dom.imageFile.files) : [];
  files.splice(index, 1);

  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  dom.imageFile.files = dt.files;
  dom.imageFile.dispatchEvent(new Event("change", { bubbles: true }));
}

function renderFileChips(files) {
  dom.fileChips.innerHTML = "";
  files.forEach((f, i) => {
    const chip = document.createElement("span");
    chip.className = "file-chip";

    const name = document.createElement("span");
    name.className = "file-chip-name";
    name.textContent = f.name;
    name.title = f.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "file-chip-remove";
    removeBtn.setAttribute("aria-label", `Quitar ${f.name}`);
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removeFileAt(i));

    chip.appendChild(name);
    chip.appendChild(removeBtn);
    dom.fileChips.appendChild(chip);
  });
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
      renderFileChips([]);
      dom.uploadHint.style.display = "";
      dom.dropzone.style.display = "";
      clearSinglePreview();
      dom.manualMode.checked = false;
      dom.manualHelp.style.display = "none";
      dom.batchHelp.style.display = "none";
      updateNPointsState();
      updateModeTabsUI();
      updateManualButtons();
      return;
    }

    renderFileChips(files);
    dom.uploadHint.style.display = files.length ? "none" : "";
    dom.dropzone.style.display = files.length ? "none" : "";

    // BATCH
    if (files.length > 1) {
      dom.manualMode.checked = false;
      dom.manualHelp.style.display = "none";
      dom.batchHelp.style.display = "block";
      setLastImageName("");
      updateNPointsState();
      updateModeTabsUI();

      clearSinglePreview();
      dom.statusEl.textContent =
        "Imágenes seleccionadas. Presiona Procesar para descargar el ZIP.";
      updateManualButtons();
      return;
    }

    // 1 imagen
    dom.batchHelp.style.display = "none";
    updateNPointsState();
    updateModeTabsUI();

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
        renderTable([]);
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
    updateModeTabsUI();

    // ✅ Si se desactiva manual: borrar puntos/tabla/overlays PERO mantener la imagen
    if (!dom.manualMode.checked) {
      setManualLocked(false);
      setLastPoints([]);
      syncNPointsFromManual();

      renderTable([]);
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

/* ===================== MODE TABS (Automático / Manual) ===================== */
export function bindModeTabs() {
  dom.tabAuto.addEventListener("click", () => {
    if (!dom.manualMode.checked) return;
    dom.manualMode.checked = false;
    dom.manualMode.dispatchEvent(new Event("change", { bubbles: true }));
  });

  dom.tabManual.addEventListener("click", () => {
    if (dom.tabManual.disabled || dom.manualMode.checked) return;
    dom.manualMode.checked = true;
    dom.manualMode.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/* ===================== VIEWER CLICK: manual add / normal zoom ===================== */
export function bindViewerClickEvents() {
  dom.viewer.addEventListener("click", (e) => {
    if (!dom.outImg.src) return;
    if (cropModeActive) return;
    if (wasLastDragASignificantMove()) return;

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
    updateManualButtons();

    dom.statusEl.textContent = "Manual: todos los puntos eliminados.";
  });
}

/* ===================== SUBMIT ===================== */
let currentAbortController = null;

function setProcessingUI(isLoading) {
  dom.processBtn.disabled = isLoading;
  dom.processBtn.classList.toggle("is-loading", isLoading);
  dom.processBtn.querySelector(".btn-label").textContent = isLoading
    ? "Procesando…"
    : "Procesar";
  dom.cancelBtn.hidden = !isLoading;
}

export function bindFormEvents() {
  dom.cancelBtn.addEventListener("click", () => {
    currentAbortController?.abort();
  });

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

    currentAbortController = new AbortController();
    setProcessingUI(true);
    try {
      // ====== BATCH ======
      if (files.length > 1) {
        dom.statusEl.textContent = `Procesando ${files.length} imágenes... (esto puede tardar)`;
        clearSinglePreview();

        const fd = new FormData();
        for (const f of files) fd.append("files", f);
        fd.append("n", String(n));
        fd.append("model_id", dom.modelSelect.value);

        try {
          const blob = await processBatch(fd, currentAbortController.signal);
          downloadBlob(blob, "resultados_coral.zip");
          dom.statusEl.textContent = "Listo ✅ ZIP descargado.";
        } catch (err) {
          dom.statusEl.textContent =
            err?.name === "AbortError"
              ? "Procesamiento cancelado."
              : "Error: " + (err?.message || "batch");
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
      setDownloadImgEnabled(false);
      setDownloadXlsxEnabled(false);

      try {
        await processSingle(fd, currentAbortController.signal);

        renderTable(lastPoints);

        setDownloadImgEnabled(true);
        setDownloadXlsxEnabled(true);
        setLastModelId(dom.modelSelect.value);

        recordHistoryEntry({
          imageBase64: lastImageBase64,
          baseName,
          imageName: fileObj.name,
          modelId: dom.modelSelect.value,
          modelName: dom.modelSelect.selectedOptions[0]?.textContent || dom.modelSelect.value,
          points: lastPoints,
          downloadToken: lastDownloadToken,
        });

        if (dom.manualMode.checked) {
          setManualLocked(true);

          // ✅ limpiar marcas manuales
          dom.overlayAll.innerHTML = "";
          dom.overlay.innerHTML = "";
          setHighlightedIdx(-1);
        }

        updateManualButtons();
        dom.statusEl.textContent = "Listo ✅ Se generaron los puntos.";
      } catch (err) {
        dom.statusEl.textContent =
          err?.name === "AbortError"
            ? "Procesamiento cancelado."
            : "Error: " + (err?.message || "process");
      }
    } finally {
      currentAbortController = null;
      setProcessingUI(false);
    }
  });
}

/* ===================== DOWNLOADS ===================== */
export function bindDownloadEvents() {
  dom.downloadImgBtn.addEventListener("click", async () => {
    if (!lastDownloadToken) {
      alert("Primero presiona Procesar.");
      return;
    }
    console.log("TOKEN:", lastDownloadToken);
    try {
      const res = await fetch(`/download/image/${lastDownloadToken}`);
      if (!res.ok) throw new Error("Error descargando imagen");

      const blob = await res.blob();
      downloadBlob(blob, `${lastBaseName || "imagen"} (anotada).png`);
    } catch (err) {
      console.error(err);
      alert("Error descargando imagen.");
    }
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
    } catch (e) {
      alert("Error descargando Excel");
      console.error(e);
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