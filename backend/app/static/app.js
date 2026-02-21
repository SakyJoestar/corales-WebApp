/* ===================== MODELOS ===================== */
const modelSelect = document.getElementById("modelSelect");
let AVAILABLE_CLASSES = [];

async function loadModels() {
  modelSelect.innerHTML = "";
  const res = await fetch("/models");
  const data = await res.json();

  if (!data.models || data.models.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(Sin modelos)";
    modelSelect.appendChild(opt);
    AVAILABLE_CLASSES = [];
    return;
  }

  if (Array.isArray(data.models[0].classes)) {
    AVAILABLE_CLASSES = data.models[0].classes;
  }

  for (const m of data.models) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.model_name || m.id;
    modelSelect.appendChild(opt);
  }
}
window.addEventListener("DOMContentLoaded", loadModels);

/* ===================== ELEMENTOS ===================== */
const imageForm = document.getElementById("imageForm");
const statusEl = document.getElementById("status");
const outImg = document.getElementById("outImg");
const viewer = document.getElementById("viewer");
const overlay = document.getElementById("overlay");
const overlayAll = document.getElementById("overlayAll");
const resetViewBtn = document.getElementById("resetViewBtn");

const tableDiv = document.getElementById("table");

const downloadImgBtn = document.getElementById("downloadImgBtn");
const downloadXlsxBtn = document.getElementById("downloadXlsxBtn");

const manualMode = document.getElementById("manualMode");
const manualHelp = document.getElementById("manualHelp");
const batchHelp = document.getElementById("batchHelp");
const nPointsInput = document.getElementById("nPoints");
const fileCount = document.getElementById("fileCount");
const imageFile = document.getElementById("imageFile");

/* ✅ bloquear añadir puntos después de procesar en manual */
let manualLocked = false;

/* ===================== ESTADO GENERAL ===================== */
let lastImageBase64 = "";
let lastPoints = [];
let lastModelId = "";
let lastBaseName = "";

let highlightedIdx = -1;

/* ===================== TRANSFORM (PAN/ZOOM) ===================== */
let scale = 1;
let offsetX = 0;
let offsetY = 0;

let dragging = false;
let startX = 0;
let startY = 0;

function applyTransform() {
  const t = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  outImg.style.transform = t;
  overlay.style.transform = t;
  overlayAll.style.transform = t;
}

function clampScale(s) {
  return Math.min(10, Math.max(0.05, s));
}

function fitToViewerCenter() {
  if (!outImg.naturalWidth || !outImg.naturalHeight) return;

  const vw = viewer.clientWidth,
    vh = viewer.clientHeight;
  const iw = outImg.naturalWidth,
    ih = outImg.naturalHeight;

  const s = Math.min(vw / iw, vh / ih);
  scale = clampScale(s);

  offsetX = (vw - iw * scale) / 2;
  offsetY = (vh - ih * scale) / 2;

  applyTransform();
}

function zoomAt(clientX, clientY, factor) {
  const rect = viewer.getBoundingClientRect();
  const vx = clientX - rect.left;
  const vy = clientY - rect.top;

  const ix = (vx - offsetX) / scale;
  const iy = (vy - offsetY) / scale;

  const newScale = clampScale(scale * factor);
  offsetX = vx - ix * newScale;
  offsetY = vy - iy * newScale;
  scale = newScale;
  applyTransform();
}

/* ===================== HELPERS ARCHIVO + LABELS ===================== */
function getBaseName(filename) {
  const justName = (filename || "").split(/[/\\]/).pop();
  const dot = justName.lastIndexOf(".");
  return dot > 0 ? justName.slice(0, dot) : justName || "imagen";
}
function sanitizeName(name) {
  return (
    (name || "imagen").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "imagen"
  );
}
function idxToLabelExcel(idx) {
  let label = "";
  while (idx > 0) {
    idx -= 1;
    label = String.fromCharCode("A".charCodeAt(0) + (idx % 26)) + label;
    idx = Math.floor(idx / 26);
  }
  return label;
}
function getNextIdx(points) {
  let mx = 0;
  for (const p of points || []) {
    const v = Number(p.idx ?? 0);
    if (!Number.isNaN(v)) mx = Math.max(mx, v);
  }
  return mx + 1;
}

/* Coordenadas imagen desde click */
function clientToImageCoords(clientX, clientY) {
  const rect = viewer.getBoundingClientRect();
  const vx = clientX - rect.left;
  const vy = clientY - rect.top;
  const ix = (vx - offsetX) / scale;
  const iy = (vy - offsetY) / scale;
  return { x: Math.round(ix), y: Math.round(iy) };
}
function isInsideImage(x, y) {
  const w = outImg.naturalWidth || 0;
  const h = outImg.naturalHeight || 0;
  return x >= 0 && y >= 0 && x < w && y < h;
}

/* ===================== BLOQUEO INPUT N EN MANUAL ===================== */
function updateNPointsState() {
  // En manual, N se calcula, por eso se deshabilita
  nPointsInput.disabled = manualMode.checked;
  if (manualMode.checked) {
    nPointsInput.style.background = "#eee";
    nPointsInput.style.cursor = "not-allowed";
  } else {
    nPointsInput.style.background = "";
    nPointsInput.style.cursor = "";
  }
}

/* ===================== N dinámico + PUNTOS MANUALES VISIBLES ===================== */
function syncNPointsFromManual() {
  nPointsInput.value = String(lastPoints.length);
}
function renderAllManualPoints() {
  overlayAll.innerHTML = "";
  if (!manualMode.checked) return;

  for (let i = 0; i < lastPoints.length; i++) {
    const p = lastPoints[i];
    const el = document.createElement("div");
    el.className = "manual-point";
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    el.innerHTML = `
      <div class="hline"></div>
      <div class="vline"></div>
      <div class="mlabel">${p.label ?? ""}</div>
    `;
    overlayAll.appendChild(el);
  }
}

/* ===================== HIGHLIGHT + ZOOM A PUNTO ===================== */
function highlightPointByIdx(idx) {
  if (!lastPoints || idx < 0 || idx >= lastPoints.length) return;

  highlightedIdx = idx;
  overlay.innerHTML = "";

  const p = lastPoints[idx];
  const marker = document.createElement("div");
  marker.className = "highlight-marker";
  marker.style.left = p.x + "px";
  marker.style.top = p.y + "px";
  marker.innerHTML = `
    <div class="hline"></div>
    <div class="vline"></div>
    <div class="hlabel">${p.label ?? ""}</div>
  `;
  overlay.appendChild(marker);

  tableDiv
    .querySelectorAll("tr")
    .forEach((tr) => tr.classList.remove("row-highlight"));
  const tr = tableDiv.querySelector(`tr[data-idx="${idx}"]`);
  if (tr) tr.classList.add("row-highlight");
}

function zoomToPoint(p, targetScale = 2.6) {
  const vw = viewer.clientWidth,
    vh = viewer.clientHeight;
  scale = clampScale(Math.max(scale, targetScale));
  offsetX = vw / 2 - p.x * scale;
  offsetY = vh / 2 - p.y * scale;
  applyTransform();
}

function highlightAndZoomToIdx(idx) {
  if (!lastPoints || idx < 0 || idx >= lastPoints.length) return;
  highlightPointByIdx(idx);
  zoomToPoint(lastPoints[idx], 2.6);
}

/* ===================== TABLA (editable + eliminar) ===================== */
function renderTable(points) {
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

  let html = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>x</th>
          <th>y</th>
          <th>clase</th>
          <th>conf</th>
          <th>origen</th>
          <th>acción</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const current = p.pred_label ?? classes[0] ?? "";

    const options = classes
      .map((c) => {
        const sel = c === current ? "selected" : "";
        return `<option value="${c}" ${sel}>${c}</option>`;
      })
      .join("");

    const origin = p.source ?? "modelo";
    const originBadge = origin.startsWith("manual")
      ? `<span class="badge manual">${origin}</span>`
      : `<span class="badge">${origin}</span>`;

    html += `
      <tr data-idx="${i}">
        <td class="idCell" style="cursor:pointer; font-weight:700; text-decoration:underline;">
          ${p.label ?? ""}
        </td>
        <td>${p.x}</td>
        <td>${p.y}</td>
        <td><select class="classSelect">${options}</select></td>
        <td class="confCell">${p.confidence != null ? Number(p.confidence).toFixed(3) : ""}</td>
        <td class="srcCell">${originBadge}</td>
        <td><button type="button" class="delBtn">Eliminar</button></td>
      </tr>
    `;
  }

  html += "</tbody></table>";
  tableDiv.innerHTML = html;

  tableDiv.querySelectorAll("select.classSelect").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const tr = e.target.closest("tr");
      const idx = Number(tr.dataset.idx);
      const newClass = e.target.value;
      if (!Array.isArray(lastPoints) || idx < 0 || idx >= lastPoints.length)
        return;

      lastPoints[idx].pred_label = newClass;

      const prev = String(lastPoints[idx].source || "modelo");
      if (!prev.startsWith("manual")) lastPoints[idx].source = "manual-edit";
      else if (prev === "manual") lastPoints[idx].source = "manual-edit";

      lastPoints[idx].confidence = null;
      tr.querySelector(".confCell").textContent = "";
      tr.querySelector(".srcCell").innerHTML =
        `<span class="badge manual">${lastPoints[idx].source}</span>`;
    });
  });

  tableDiv.querySelectorAll("td.idCell").forEach((td) => {
    td.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      const idx = Number(tr.dataset.idx);
      highlightAndZoomToIdx(idx);
    });
  });

  tableDiv.querySelectorAll("button.delBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      const idx = Number(tr.dataset.idx);
      if (!Array.isArray(lastPoints) || idx < 0 || idx >= lastPoints.length)
        return;

      if (highlightedIdx === idx) {
        overlay.innerHTML = "";
        highlightedIdx = -1;
      }

      lastPoints.splice(idx, 1);
      syncNPointsFromManual();
      renderTable(lastPoints);
      renderAllManualPoints();
    });
  });
}

/* ===================== LIMPIAR PREVIEW (no mostrar nada antes de procesar) ===================== */
function clearSinglePreview() {
  outImg.src = "";
  overlay.innerHTML = "";
  overlayAll.innerHTML = "";
  highlightedIdx = -1;
  tableDiv.innerHTML = "";
  downloadImgBtn.disabled = true;
  downloadXlsxBtn.disabled = true;
}

/* ===================== MODO MANUAL: PREVIEW SIN PUNTOS (solo 1) ===================== */
function loadOriginalImageForManual() {
  const files = imageFile.files;
  if (!files || files.length !== 1) return;

  const fileObj = files[0];
  manualLocked = false;

  statusEl.textContent =
    "Manual: imagen cargada. Click para agregar puntos y luego presiona Procesar.";
  downloadImgBtn.disabled = true;
  downloadXlsxBtn.disabled = true;

  lastImageBase64 = "";
  lastModelId = modelSelect.value || "";
  lastBaseName = sanitizeName(getBaseName(fileObj.name));

  lastPoints = [];
  syncNPointsFromManual();
  renderTable(lastPoints);

  overlay.innerHTML = "";
  overlayAll.innerHTML = "";
  highlightedIdx = -1;

  const reader = new FileReader();
  reader.onload = () => {
    outImg.src = reader.result;
  };
  reader.readAsDataURL(fileObj);
}

/* ===================== FILE INPUT CHANGE ===================== */
imageFile.addEventListener("change", () => {
  const files = imageFile.files ? Array.from(imageFile.files) : [];
  fileCount.textContent = files.length
    ? `${files.length} archivo(s) seleccionado(s)`
    : "";

  // Validación simple
  if (files.length > 25) {
    statusEl.textContent = "Error: Máximo 25 imágenes.";
    imageFile.value = "";
    fileCount.textContent = "";
    clearSinglePreview();
    manualMode.checked = false;
    manualHelp.style.display = "none";
    batchHelp.style.display = "none";
    updateNPointsState();
    return;
  }

  // MODO MÚLTIPLE (batch)
  if (files.length > 1) {
    // forzar automático
    manualMode.checked = false;
    manualHelp.style.display = "none";
    batchHelp.style.display = "block";
    updateNPointsState();

    clearSinglePreview();
    statusEl.textContent =
      "Imágenes seleccionadas. Presiona Procesar para descargar el ZIP.";
    return;
  }

  // 1 imagen
  batchHelp.style.display = "none";
  updateNPointsState();

  // si NO manual: no mostrar antes de procesar
  if (!manualMode.checked) {
    clearSinglePreview();
    statusEl.textContent =
      files.length === 1 ? "Imagen seleccionada. Presiona Procesar." : "";
    return;
  }

  // si manual: mostrar original para marcar
  if (files.length === 1) {
    manualHelp.style.display = "block";
    loadOriginalImageForManual();
  }
});

/* ===================== MANUAL CHECK CHANGE ===================== */
manualMode.addEventListener("change", () => {
  const files = imageFile.files ? Array.from(imageFile.files) : [];
  // Manual solo tiene sentido con 1 imagen
  if (files.length !== 1 && manualMode.checked) {
    manualMode.checked = false;
  }

  manualHelp.style.display =
    manualMode.checked && files.length === 1 ? "block" : "none";
  batchHelp.style.display = files.length > 1 ? "block" : "none";
  updateNPointsState();

  if (manualMode.checked && files.length === 1) {
    loadOriginalImageForManual();
  } else {
    // si desmarcas manual y hay 1 imagen, no mostrarla hasta procesar
    if (files.length === 1) {
      clearSinglePreview();
      statusEl.textContent = "Imagen seleccionada. Presiona Procesar.";
    }
  }
});

/* ===================== SUBMIT ===================== */
imageForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const files = imageFile.files ? Array.from(imageFile.files) : [];
  if (files.length === 0) {
    statusEl.textContent = "Selecciona al menos 1 imagen.";
    return;
  }

  if (!modelSelect.value) {
    statusEl.textContent = "Selecciona un modelo.";
    return;
  }

  const n = Number(nPointsInput.value || 0);
  if (!Number.isFinite(n) || n < 1) {
    statusEl.textContent = "N puntos debe ser >= 1.";
    return;
  }

  // ====== BATCH ======
  if (files.length > 1) {
    statusEl.textContent = `Procesando ${files.length} imágenes... (esto puede tardar)`;
    clearSinglePreview();

    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    fd.append("n", String(n));
    fd.append("model_id", modelSelect.value);

    const res = await fetch("/process_batch", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      let msg = "Error procesando batch";
      try {
        msg = (await res.json()).error || msg;
      } catch {}
      statusEl.textContent = "Error: " + msg;
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resultados_coral.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    statusEl.textContent = "Listo ✅ ZIP descargado.";
    return;
  }

  // ====== SINGLE ======
  const fileObj = files[0];
  const baseName = sanitizeName(getBaseName(fileObj.name));

  const fd = new FormData();
  fd.append("file", fileObj);

  if (manualMode.checked) {
    // n = puntos manuales (bloqueado)
    syncNPointsFromManual();
    fd.append("n", String(lastPoints.length));
    fd.append("points_json", JSON.stringify(lastPoints));
  } else {
    fd.append("n", String(n));
  }

  fd.append("model_id", modelSelect.value);

  statusEl.textContent = "Procesando imagen...";
  downloadImgBtn.disabled = true;
  downloadXlsxBtn.disabled = true;

  const res = await fetch("/process", { method: "POST", body: fd });
  const data = await res.json();

  if (!res.ok) {
    statusEl.textContent = "Error: " + (data.error || res.status);
    return;
  }

  outImg.src = "data:image/png;base64," + data.annotated_image_base64;

  lastImageBase64 = data.annotated_image_base64;
  lastPoints = data.points || [];
  lastModelId = modelSelect.value;
  lastBaseName = baseName;

  // si procesaste en manual, bloquear nuevos puntos
  if (manualMode.checked) manualLocked = true;

  overlayAll.innerHTML = "";
  overlay.innerHTML = "";
  highlightedIdx = -1;

  renderTable(lastPoints);

  downloadImgBtn.disabled = false;
  downloadXlsxBtn.disabled = false;

  statusEl.textContent = "Listo ✅";
});

/* ===================== DESCARGAS (solo 1) ===================== */
function downloadBase64Image(base64Png, filename = "imagen_anotada.png") {
  const a = document.createElement("a");
  a.href = "data:image/png;base64," + base64Png;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

downloadImgBtn.addEventListener("click", () => {
  if (!lastImageBase64) return;
  downloadBase64Image(
    lastImageBase64,
    `${lastBaseName || "imagen"} (anotada).png`,
  );
});

downloadXlsxBtn.addEventListener("click", async () => {
  if (!lastPoints || lastPoints.length === 0) return;

  const res = await fetch("/export/excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      points: lastPoints,
      model_id: lastModelId,
    }),
  });

  if (!res.ok) {
    alert("Error descargando Excel");
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${lastBaseName || "imagen"} (tabla).xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
});

/* ===================== INTERACCIONES VISOR (solo 1) ===================== */
viewer.addEventListener("mousedown", (e) => {
  dragging = true;
  startX = e.clientX - offsetX;
  startY = e.clientY - offsetY;
  viewer.style.cursor = "grabbing";
});

window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  offsetX = e.clientX - startX;
  offsetY = e.clientY - startY;
  applyTransform();
});

window.addEventListener("mouseup", () => {
  dragging = false;
  viewer.style.cursor = "grab";
});

viewer.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAt(e.clientX, e.clientY, factor);
  },
  { passive: false },
);

viewer.addEventListener("click", (e) => {
  if (!outImg.src) return;

  if (manualMode.checked) {
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

    const p = {
      idx: nextIdx,
      label,
      x,
      y,
      x_norm: outImg.naturalWidth ? x / outImg.naturalWidth : 0,
      y_norm: outImg.naturalHeight ? y / outImg.naturalHeight : 0,
      pred_label: classes[0] || "",
      confidence: null,
      source: "manual",
    };

    lastPoints.push(p);

    syncNPointsFromManual();
    renderTable(lastPoints);
    renderAllManualPoints();
    highlightPointByIdx(lastPoints.length - 1);

    statusEl.textContent = `Manual: puntos = ${lastPoints.length}. Presiona Procesar cuando termines.`;
    return;
  }

  const factor = e.shiftKey ? 1 / 1.25 : 1.25;
  zoomAt(e.clientX, e.clientY, factor);
});

resetViewBtn.addEventListener("click", () => fitToViewerCenter());

outImg.onload = () => {
  fitToViewerCenter();

  overlay.style.width = outImg.naturalWidth + "px";
  overlay.style.height = outImg.naturalHeight + "px";

  overlayAll.style.width = outImg.naturalWidth + "px";
  overlayAll.style.height = outImg.naturalHeight + "px";

  overlay.innerHTML = "";
  highlightedIdx = -1;

  if (manualMode.checked) renderAllManualPoints();
};

window.addEventListener("resize", () => {
  if (outImg.src) fitToViewerCenter();
});

/* init */
updateNPointsState();
