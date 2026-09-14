export const dom = {};

export function initDom() {
  dom.imageForm = document.getElementById("imageForm");
  dom.processBtn = document.getElementById("processBtn");
  dom.cancelBtn = document.getElementById("cancelBtn");
  dom.imageFile = document.getElementById("imageFile");
  dom.dropzone = document.getElementById("dropzone");
  dom.fileCount = document.getElementById("fileCount");
  dom.fileChips = document.getElementById("fileChips");
  dom.uploadHint = document.getElementById("uploadHint");
  dom.modelSelect = document.getElementById("modelSelect");
  dom.nPointsInput = document.getElementById("nPoints");
  dom.manualMode = document.getElementById("manualMode");
  dom.manualHelp = document.getElementById("manualHelp");
  dom.batchHelp = document.getElementById("batchHelp");
  dom.configSection = document.getElementById("configSection");
  dom.tabAuto = document.getElementById("tabAuto");
  dom.tabManual = document.getElementById("tabManual");
  dom.nPointsField = document.getElementById("nPointsField");
  dom.statusEl = document.getElementById("status");

  dom.viewer = document.getElementById("viewer");
  dom.outImg = document.getElementById("outImg");
  dom.overlay = document.getElementById("overlay");
  dom.overlayAll = document.getElementById("overlayAll");
  dom.cropBtn = document.getElementById("cropBtn");
  dom.cropCancelBtn = document.getElementById("cropCancelBtn");
  dom.cropOverlay = document.getElementById("cropOverlay");

  dom.tableDiv = document.getElementById("table");
  dom.coverageDiv = document.getElementById("coverageCard");

  dom.downloadImgBtn = document.getElementById("downloadImgBtn");
  dom.downloadXlsxBtn = document.getElementById("downloadXlsxBtn");

  dom.deleteLastBtn = document.getElementById("deleteLastBtn");
  dom.deleteAllBtn = document.getElementById("deleteAllBtn");

  dom.themeToggleBtn = document.getElementById("themeToggleBtn");

  dom.zoomInBtn = document.getElementById("zoomInBtn");
  dom.zoomOutBtn = document.getElementById("zoomOutBtn");
  dom.zoomResetBtn = document.getElementById("zoomResetBtn");

  dom.classLegend = document.getElementById("classLegend");

  dom.historyList = document.getElementById("historyList");
  dom.historyCount = document.getElementById("historyCount");
  dom.historyBtn = document.getElementById("historyBtn");
  dom.historyModal = document.getElementById("historyModal");
  dom.historyModalCloseBtn = document.getElementById("historyModalCloseBtn");
  dom.clearHistoryBtn = document.getElementById("clearHistoryBtn");

  // Validación rápida: si falta algo, lo sabrás al instante
  const required = ["modelSelect", "imageForm", "viewer", "outImg"];
  for (const k of required) {
    if (!dom[k]) {
      throw new Error(`DOM no inicializado correctamente: falta #${k}`);
    }
  }

  return dom;
}