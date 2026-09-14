import { dom } from "./dom.js";
import { setCropModeActive, setLastPoints, setHighlightedIdx, syncNPointsFromManual, updateManualButtons } from "./state.js";
import { clientToImageCoords } from "./viewer.js";
import { renderTable } from "./render.js";

/* ===================== RECORTAR IMAGEN (marco ajustable, estilo WhatsApp) ===================== */
const MIN_SIZE = 24; // tamaño mínimo del recorte en px de pantalla

let editing = false;
let box = null; // { left, top, width, height } en px locales del visor
let interaction = null; // { type: "move"|"top"|"bottom"|"left"|"right", startX, startY, startBox }

function setCropLabel(text) {
  const label = dom.cropBtn.querySelector(".btn-label");
  if (label) label.textContent = text;
}

function viewerSize() {
  return { vw: dom.viewer.clientWidth, vh: dom.viewer.clientHeight };
}

function viewerLocalPoint(clientX, clientY) {
  const rect = dom.viewer.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function defaultBox() {
  const { vw, vh } = viewerSize();
  const mx = vw * 0.15;
  const my = vh * 0.15;
  return { left: mx, top: my, width: vw - mx * 2, height: vh - my * 2 };
}

function renderBox() {
  if (!box) return;
  dom.cropOverlay.hidden = false;
  dom.cropOverlay.style.left = `${box.left}px`;
  dom.cropOverlay.style.top = `${box.top}px`;
  dom.cropOverlay.style.width = `${box.width}px`;
  dom.cropOverlay.style.height = `${box.height}px`;
}

function startEditing() {
  editing = true;
  box = defaultBox();
  setCropModeActive(true);
  dom.viewer.classList.add("crop-mode");
  dom.cropBtn.classList.add("is-active");
  dom.cropCancelBtn.style.display = "inline-flex";
  setCropLabel("Aplicar recorte");
  renderBox();
}

function stopEditing() {
  editing = false;
  box = null;
  interaction = null;
  setCropModeActive(false);
  dom.viewer.classList.remove("crop-mode");
  dom.cropBtn.classList.remove("is-active");
  dom.cropCancelBtn.style.display = "none";
  setCropLabel("Recortar imagen");
  dom.cropOverlay.hidden = true;
}

function applyCrop() {
  if (!box) return;

  const rect = dom.viewer.getBoundingClientRect();
  const c1 = clientToImageCoords(rect.left + box.left, rect.top + box.top);
  const c2 = clientToImageCoords(rect.left + box.left + box.width, rect.top + box.top + box.height);

  const iw = dom.outImg.naturalWidth || 0;
  const ih = dom.outImg.naturalHeight || 0;
  const x0 = Math.max(0, Math.min(iw, Math.min(c1.x, c2.x)));
  const y0 = Math.max(0, Math.min(ih, Math.min(c1.y, c2.y)));
  const x1 = Math.max(0, Math.min(iw, Math.max(c1.x, c2.x)));
  const y1 = Math.max(0, Math.min(ih, Math.max(c1.y, c2.y)));
  const w = x1 - x0;
  const h = y1 - y0;

  if (w < 4 || h < 4) {
    dom.statusEl.textContent = "Selecciona un área más grande para recortar.";
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w);
  canvas.height = Math.round(h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(dom.outImg, x0, y0, w, h, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/png");
  const originalName = (dom.imageFile.files && dom.imageFile.files[0]?.name) || "imagen.png";

  canvas.toBlob((blob) => {
    if (blob) {
      const croppedFile = new File([blob], originalName, { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(croppedFile);
      dom.imageFile.files = dt.files;
    }

    dom.outImg.src = dataUrl;

    setLastPoints([]);
    syncNPointsFromManual();
    renderTable([]);
    dom.overlay.innerHTML = "";
    dom.overlayAll.innerHTML = "";
    setHighlightedIdx(-1);
    updateManualButtons();

    dom.statusEl.textContent = "Imagen recortada. Los puntos anteriores se reiniciaron.";
    stopEditing();
  }, "image/png");
}

function onHandleOrBoxMouseDown(e) {
  if (!editing) return;
  e.preventDefault();
  e.stopPropagation();

  const edge = e.target.dataset ? e.target.dataset.edge : undefined;
  const p = viewerLocalPoint(e.clientX, e.clientY);
  interaction = { type: edge || "move", startX: p.x, startY: p.y, startBox: { ...box } };
}

function onWindowMouseMove(e) {
  if (!interaction || !box) return;

  const p = viewerLocalPoint(e.clientX, e.clientY);
  const dx = p.x - interaction.startX;
  const dy = p.y - interaction.startY;
  const sb = interaction.startBox;
  const { vw, vh } = viewerSize();
  const type = interaction.type;

  if (type === "move") {
    box.left = Math.max(0, Math.min(vw - sb.width, sb.left + dx));
    box.top = Math.max(0, Math.min(vh - sb.height, sb.top + dy));
    box.width = sb.width;
    box.height = sb.height;
    renderBox();
    return;
  }

  // componente vertical (los handles de esquina combinan uno vertical + uno horizontal)
  if (type.includes("top")) {
    const newTop = Math.max(0, Math.min(sb.top + sb.height - MIN_SIZE, sb.top + dy));
    box.top = newTop;
    box.height = sb.top + sb.height - newTop;
  } else if (type.includes("bottom")) {
    const newBottom = Math.min(vh, Math.max(sb.top + MIN_SIZE, sb.top + sb.height + dy));
    box.top = sb.top;
    box.height = newBottom - sb.top;
  } else {
    box.top = sb.top;
    box.height = sb.height;
  }

  // componente horizontal
  if (type.includes("left")) {
    const newLeft = Math.max(0, Math.min(sb.left + sb.width - MIN_SIZE, sb.left + dx));
    box.left = newLeft;
    box.width = sb.left + sb.width - newLeft;
  } else if (type.includes("right")) {
    const newRight = Math.min(vw, Math.max(sb.left + MIN_SIZE, sb.left + sb.width + dx));
    box.left = sb.left;
    box.width = newRight - sb.left;
  } else {
    box.left = sb.left;
    box.width = sb.width;
  }

  renderBox();
}

export function bindCropButton() {
  dom.cropBtn.addEventListener("click", () => {
    if (!editing) {
      startEditing();
      dom.statusEl.textContent = 'Ajusta los bordes del recorte y presiona "Aplicar recorte".';
    } else {
      applyCrop();
    }
  });

  dom.cropCancelBtn.addEventListener("click", () => {
    stopEditing();
    dom.statusEl.textContent = "Recorte cancelado.";
  });

  dom.cropOverlay.addEventListener("mousedown", onHandleOrBoxMouseDown);
  window.addEventListener("mousemove", onWindowMouseMove);
  window.addEventListener("mouseup", () => {
    interaction = null;
  });

  // si se cambia o se carga una nueva imagen, el recorte pendiente ya no aplica
  dom.imageFile.addEventListener("change", () => {
    if (editing) stopEditing();
  });
  dom.outImg.addEventListener("load", () => {
    if (editing) stopEditing();
  });
}
