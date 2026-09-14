import { dom } from "./dom.js";
import { scale, offsetX, offsetY, setTransform, cropModeActive } from "./state.js";

/* ===================== PAN / ZOOM ===================== */
// Al tamaño mínimo (imagen completa visible) el arrastre no mueve nada porque
// clampPan la mantiene centrada; solo se puede mover una vez se hace zoom in.

let dragging = false;
let startX = 0;
let startY = 0;

// distingue un click (agregar punto en modo manual) de un arrastre (mover imagen)
const DRAG_THRESHOLD = 4; // px
let dragStartClientX = 0;
let dragStartClientY = 0;
let dragMoved = false;

export function wasLastDragASignificantMove() {
  return dragMoved;
}

export function applyTransform() {
  const t = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  dom.outImg.style.transform = t;
  dom.overlay.style.transform = t;
  dom.overlayAll.style.transform = t;
}

// escala mínima permitida: la que hace que la imagen quepa completa en el visor
// (nunca se recorta; puede quedar franja vacía si la proporción no coincide)
function minFitScale() {
  const vw = dom.viewer.clientWidth;
  const vh = dom.viewer.clientHeight;
  const iw = dom.outImg.naturalWidth || 0;
  const ih = dom.outImg.naturalHeight || 0;
  if (!iw || !ih || !vw || !vh) return 0.05;
  return Math.min(vw / iw, vh / ih);
}

function clampScale(s) {
  return Math.min(10, Math.max(minFitScale(), s));
}

// evita que el pan/zoom deje la imagen fuera del visor (espacio vacío)
function clampPan(s, ox, oy) {
  const vw = dom.viewer.clientWidth;
  const vh = dom.viewer.clientHeight;
  const iw = (dom.outImg.naturalWidth || 0) * s;
  const ih = (dom.outImg.naturalHeight || 0) * s;

  let x = ox;
  if (iw <= vw) {
    x = (vw - iw) / 2;
  } else {
    x = Math.min(0, Math.max(vw - iw, ox));
  }

  let y = oy;
  if (ih <= vh) {
    y = (vh - ih) / 2;
  } else {
    y = Math.min(0, Math.max(vh - ih, oy));
  }

  return { x, y };
}

export function fitToViewerCenter() {
  if (!dom.outImg.naturalWidth || !dom.outImg.naturalHeight) return;

  const vw = dom.viewer.clientWidth;
  const vh = dom.viewer.clientHeight;
  const iw = dom.outImg.naturalWidth;
  const ih = dom.outImg.naturalHeight;

  const s = Math.min(vw / iw, vh / ih);

  const newScale = clampScale(s);
  const newOffsetX = (vw - iw * newScale) / 2;
  const newOffsetY = (vh - ih * newScale) / 2;

  setTransform(newScale, newOffsetX, newOffsetY);
  applyTransform();
}

export function zoomAt(clientX, clientY, factor) {
  const rect = dom.viewer.getBoundingClientRect();
  const vx = clientX - rect.left;
  const vy = clientY - rect.top;

  const ix = (vx - offsetX) / scale;
  const iy = (vy - offsetY) / scale;

  const newScale = clampScale(scale * factor);
  const rawOffsetX = vx - ix * newScale;
  const rawOffsetY = vy - iy * newScale;
  const { x, y } = clampPan(newScale, rawOffsetX, rawOffsetY);

  setTransform(newScale, x, y);
  applyTransform();
}

/* ===================== EVENT BINDINGS ===================== */

export function bindViewerEvents() {
  dom.viewer.addEventListener("mousedown", (e) => {
    if (cropModeActive) return;
    dragging = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
    dragStartClientX = e.clientX;
    dragStartClientY = e.clientY;
    dragMoved = false;
    dom.viewer.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    if (!dragMoved) {
      const d = Math.hypot(e.clientX - dragStartClientX, e.clientY - dragStartClientY);
      if (d > DRAG_THRESHOLD) dragMoved = true;
    }
    const rawOffsetX = e.clientX - startX;
    const rawOffsetY = e.clientY - startY;
    const { x, y } = clampPan(scale, rawOffsetX, rawOffsetY);
    setTransform(scale, x, y);
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
    dom.viewer.style.cursor = "";
  });

  dom.viewer.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (cropModeActive) return;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomAt(e.clientX, e.clientY, factor);
    },
    { passive: false }
  );

}

export function clientToImageCoords(clientX, clientY) {
  const rect = dom.viewer.getBoundingClientRect();
  const vx = clientX - rect.left;
  const vy = clientY - rect.top;

  const ix = (vx - offsetX) / scale;
  const iy = (vy - offsetY) / scale;

  return { x: Math.round(ix), y: Math.round(iy) };
}

export function isInsideImage(x, y) {
  const w = dom.outImg.naturalWidth || 0;
  const h = dom.outImg.naturalHeight || 0;
  return x >= 0 && y >= 0 && x < w && y < h;
}

export function zoomToPoint(p, targetScale = 2.6) {
  const vw = dom.viewer.clientWidth;
  const vh = dom.viewer.clientHeight;

  const newScale = clampScale(Math.max(scale, targetScale));
  const rawOffsetX = (vw / 2) - (p.x * newScale);
  const rawOffsetY = (vh / 2) - (p.y * newScale);
  const { x, y } = clampPan(newScale, rawOffsetX, rawOffsetY);

  setTransform(newScale, x, y);
  applyTransform();
}

export function zoomAtCenter(factor) {
  const rect = dom.viewer.getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
}

export function updateResetButtonState() {
  const hasImage = !!dom.outImg.src;
  dom.zoomResetBtn.disabled = !hasImage;
}