export const dom = {};

export function initDom() {
  dom.imageForm = document.getElementById("imageForm");
  dom.imageFile = document.getElementById("imageFile");
  dom.fileCount = document.getElementById("fileCount");
  dom.modelSelect = document.getElementById("modelSelect");
  dom.nPointsInput = document.getElementById("nPoints");
  dom.manualMode = document.getElementById("manualMode");
  dom.manualHelp = document.getElementById("manualHelp");
  dom.batchHelp = document.getElementById("batchHelp");
  dom.statusEl = document.getElementById("status");

  dom.viewer = document.getElementById("viewer");
  dom.outImg = document.getElementById("outImg");
  dom.overlay = document.getElementById("overlay");
  dom.overlayAll = document.getElementById("overlayAll");
  dom.resetViewBtn = document.getElementById("resetViewBtn");

  dom.tableDiv = document.getElementById("table");

  dom.downloadImgBtn = document.getElementById("downloadImgBtn");
  dom.downloadXlsxBtn = document.getElementById("downloadXlsxBtn");

  dom.deleteLastBtn = document.getElementById("deleteLastBtn");
  dom.deleteAllBtn = document.getElementById("deleteAllBtn");

  // Validación rápida: si falta algo, lo sabrás al instante
  const required = ["modelSelect", "imageForm", "viewer", "outImg"];
  for (const k of required) {
    if (!dom[k]) {
      throw new Error(`DOM no inicializado correctamente: falta #${k}`);
    }
  }

  return dom;
}