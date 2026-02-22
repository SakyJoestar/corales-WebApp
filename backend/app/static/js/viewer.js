import { dom } from "./dom.js";
import { scale, offsetX, offsetY, setTransform } from "./state.js";

/* ===================== PAN / ZOOM ===================== */

let dragging = false;
let startX = 0;
let startY = 0;

export function applyTransform() {
  const t = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  dom.outImg.style.transform = t;
  dom.overlay.style.transform = t;
  dom.overlayAll.style.transform = t;
}

function clampScale(s) {
  return Math.min(10, Math.max(0.05, s));
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
  const newOffsetX = vx - ix * newScale;
  const newOffsetY = vy - iy * newScale;

  setTransform(newScale, newOffsetX, newOffsetY);
  applyTransform();
}

/* ===================== EVENT BINDINGS ===================== */

export function bindViewerEvents() {
  dom.viewer.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
    dom.viewer.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const newOffsetX = e.clientX - startX;
    const newOffsetY = e.clientY - startY;
    setTransform(scale, newOffsetX, newOffsetY);
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
    dom.viewer.style.cursor = "grab";
  });

  dom.viewer.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomAt(e.clientX, e.clientY, factor);
    },
    { passive: false }
  );

  dom.resetViewBtn.addEventListener("click", fitToViewerCenter);
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

  const newScale = Math.min(10, Math.max(0.05, Math.max(scale, targetScale)));
  const newOffsetX = (vw / 2) - (p.x * newScale);
  const newOffsetY = (vh / 2) - (p.y * newScale);

  setTransform(newScale, newOffsetX, newOffsetY);
  applyTransform();
}

export function updateResetButtonState() {
  const hasImage = !!dom.outImg.src;
  dom.resetViewBtn.disabled = !hasImage;
}