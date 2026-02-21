import { dom } from "./dom.js";
import {
  setAvailableClasses,
  setLastImageBase64,
  setLastPoints,
  setLastModelId,
  setLastBaseName,
  setManualLocked,
} from "./state.js";

/* ===================== MODELOS ===================== */

export async function loadModels() {
  dom.modelSelect.innerHTML = "";

  let res;
  try {
    res = await fetch("/models");
  } catch (e) {
    dom.statusEl.textContent =
      "Error: no se pudo conectar al backend (/models).";
    throw e;
  }

  if (!res.ok) {
    dom.statusEl.textContent = `Error: /models devolvió ${res.status}`;
    throw new Error(`/models HTTP ${res.status}`);
  }

  const data = await res.json();

  if (!data.models || data.models.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(Sin modelos)";
    dom.modelSelect.appendChild(opt);
    setAvailableClasses([]);
    return;
  }

  if (Array.isArray(data.models[0].classes)) {
    setAvailableClasses(data.models[0].classes);
  }

  for (const m of data.models) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.model_name || m.id;
    dom.modelSelect.appendChild(opt);
  }
}

/* ===================== PROCESS SINGLE ===================== */

export async function processSingle(fd) {
  const res = await fetch("/process", {
    method: "POST",
    body: fd,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Error procesando imagen");
  }

  dom.outImg.src = "data:image/png;base64," + data.annotated_image_base64;

  setLastImageBase64(data.annotated_image_base64);
  setLastPoints(data.points || []);
  setLastModelId(dom.modelSelect.value);

  return data;
}

/* ===================== PROCESS BATCH ===================== */

export async function processBatch(fd) {
  const res = await fetch("/process_batch", {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    let msg = "Error procesando batch";
    try {
      msg = (await res.json()).error || msg;
    } catch {}
    throw new Error(msg);
  }

  return await res.blob();
}

/* ===================== EXPORT EXCEL ===================== */

export async function exportExcel(points, modelId) {
  const res = await fetch("/export/excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      points,
      model_id: modelId,
    }),
  });

  if (!res.ok) {
    throw new Error("Error descargando Excel");
  }

  return await res.blob();
}
