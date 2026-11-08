import { dom } from "./dom.js";
import { setHighlightedIdx } from "./state.js";
import { fitToViewerCenter } from "./viewer.js";

// Enfoque de un punto: al elegir un ID en resultados se ocultan los demás puntos.
// En la imagen procesada los puntos vienen dibujados en el PNG, así que se tapa
// con la original (#baseImg); en modo manual basta con ocultar #overlayAll.

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Imagen limpia correspondiente al resultado que se está mostrando
export async function setBaseImageFromFile(file) {
  if (!file) return clearBaseImage();
  setBaseImageSrc(await fileToDataUrl(file));
}

export function setBaseImageSrc(src) {
  if (!dom.baseImg) return;
  if (src) dom.baseImg.src = src;
  else dom.baseImg.removeAttribute("src");
}

export function getBaseImageSrc() {
  return dom.baseImg?.getAttribute("src") || "";
}

export function clearBaseImage() {
  setBaseImageSrc("");
}

// Solo sirve si calza píxel a píxel con la anotada (p. ej. una foto con
// rotación EXIF la muestra el navegador girada y el servidor no).
function baseImageAligned() {
  const b = dom.baseImg;
  return !!getBaseImageSrc() && b.complete && b.naturalWidth > 0 &&
    b.naturalWidth === dom.outImg.naturalWidth &&
    b.naturalHeight === dom.outImg.naturalHeight;
}

export function enterPointFocus() {
  dom.viewer.classList.add("focus-mode");
  dom.viewer.classList.toggle("has-base", baseImageAligned());
  dom.showAllPointsBtn.hidden = false;
}

export function exitPointFocus({ refit = true } = {}) {
  dom.viewer.classList.remove("focus-mode", "has-base");
  dom.showAllPointsBtn.hidden = true;
  dom.overlay.innerHTML = "";
  setHighlightedIdx(-1);
  dom.tableDiv
    ?.querySelectorAll("tr.row-highlight")
    .forEach((tr) => tr.classList.remove("row-highlight"));
  if (refit) fitToViewerCenter();
}

export function bindPointFocus() {
  dom.showAllPointsBtn?.addEventListener("click", () => exitPointFocus());
}
