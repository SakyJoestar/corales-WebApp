import { dom } from "./dom.js";
import {
  AVAILABLE_CLASSES,
  lastPoints,
  setLastPoints,
  highlightedIdx,
  setHighlightedIdx,
} from "./state.js";
import { zoomToPoint } from "./viewer.js";
import { getDetailLevels } from "./levels.js";
import { enterPointFocus, exitPointFocus } from "./focus.js";
import { updateManualButtons, syncNPointsFromManual } from "./state.js";
import {
  classColorVar,
  classDisplayLabel,
  CORAL_CONDITIONS,
  CONDITION_CLASS,
  conditionColorVar,
} from "./classColors.js";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

const PLUS_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>`;
const NOTE_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12l-4 4H4z"></path><path d="M9 9h6M9 13h4"></path></svg>`;
const TRASH_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"></path><path d="M10 11v6M14 11v6"></path></svg>`;
const EMPTY_RESULTS_ICON = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M4 17l4-4 3 2 5-6 4 4" opacity="0.5"/><circle cx="8" cy="9" r="1"/><circle cx="13.5" cy="13" r="1"/><circle cx="17" cy="8.5" r="1"/></svg>`;

// Pastilla de confianza para lo que sugirió el modelo (vacía si se editó a mano)
function miniConfHtml(conf) {
  if (conf == null) return "";
  const q = confQuality(Number(conf));
  return `<span class="conf-badge mini ${q.cls}" title="Confianza del modelo">${q.pct}%</span>`;
}

// Celda de estado: selector solo si el punto es Coral, "—" en cualquier otra clase.
function conditionCellHtml(p) {
  if (p.pred_label !== CONDITION_CLASS) {
    return `<span class="condition-na" title="Solo aplica a Coral">—</span>`;
  }
  const current = p.condition ?? "";
  const options = [`<option value="" ${current ? "" : "selected"}>—</option>`]
    .concat(
      CORAL_CONDITIONS.map(
        (c) => `<option value="${c.code}" ${c.code === current ? "selected" : ""}>${escapeHtml(c.label)}</option>`
      )
    )
    .join("");
  return `
    <div class="conditionCell">
      <span class="condition-dot" style="background:${conditionColorVar(current)};"></span>
      <select class="conditionSelect" aria-label="Estado del coral">${options}</select>
      ${miniConfHtml(p.condition_confidence)}
    </div>`;
}

function confQuality(conf) {
  if (conf >= 0.75) return { cls: "conf-high", pct: Math.round(conf * 100) };
  if (conf >= 0.5) return { cls: "conf-medium", pct: Math.round(conf * 100) };
  return { cls: "conf-low", pct: Math.round(conf * 100) };
}

export function renderLegend() {
  if (!dom.classLegend) return;

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

  dom.classLegend.innerHTML = classes
    .map(
      (c) => `
    <span class="legend-item">
      <span class="legend-dot" style="background:${classColorVar(c)};"></span>${escapeHtml(classDisplayLabel(c))}
    </span>`
    )
    .join("");
}

export function renderAllManualPoints() {
  dom.overlayAll.innerHTML = "";
  if (!dom.manualMode.checked) return;

  const W = dom.outImg.naturalWidth;
  const H = dom.outImg.naturalHeight;

  // Mismas proporciones que la imagen anotada del servidor (backend/app/services/draw.py).
  // Todo va en píxeles de la foto, que el visor reduce: por eso los bordes son relativos
  // al tamaño de la foto y no fijos. Antes de procesar el punto aún no tiene clase: blanco.
  const s = Math.min(W, H);
  const radius = Math.max(6, Math.floor(s * 0.009));
  const ring = Math.max(2, Math.floor(s * 0.0024));
  const outline = Math.max(1, Math.floor(ring / 2));
  const dot = Math.max(2, Math.floor(s * 0.0012));
  const fontSize = Math.max(26, Math.floor(s * 0.034));
  const stroke = Math.max(2, Math.floor(fontSize / 14));
  const rOut = radius + outline;
  const textShadow = [
    [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
  ].map(([dx, dy]) => `${dx * stroke}px ${dy * stroke}px 0 #000`).join(", ");

  for (const p of lastPoints) {
    const el = document.createElement("div");
    el.className = "point-marker";
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    el.style.setProperty("--marker-color", "#ffffff");

    el.innerHTML = `
  <div class="dot" style="width:${2 * radius}px; height:${2 * radius}px; border-width:${ring}px; box-shadow:0 0 0 ${outline}px #000, inset 0 0 0 ${outline}px #000;"></div>
  <div class="center-dot" style="width:${2 * dot}px; height:${2 * dot}px; box-shadow:0 0 0 ${outline}px #000;"></div>
  <div class="plabel" style="left:${rOut + stroke + 4}px; top:${-Math.floor(fontSize / 2)}px; font-size:${fontSize}px; line-height:1; text-shadow:${textShadow};">
    ${p.label ?? ""}
  </div>
`;

    dom.overlayAll.appendChild(el);
  }
}

export function highlightPointByIdx(idx) {
  if (!lastPoints || idx < 0 || idx >= lastPoints.length) return;

  setHighlightedIdx(idx);
  dom.overlay.innerHTML = "";

  const p = lastPoints[idx];
  const W = dom.outImg.naturalWidth || 0;
  const H = dom.outImg.naturalHeight || 0;
  const ringSize = Math.max(30, Math.floor(Math.min(W, H) * 0.045));
  const half = Math.floor(ringSize / 2);
  const fontSize = Math.max(16, Math.floor(Math.min(W, H) * 0.024));

  const marker = document.createElement("div");
  marker.className = "highlight-marker";
  marker.style.left = p.x + "px";
  marker.style.top = p.y + "px";
  marker.innerHTML = `
    <div class="ring" style="width:${ringSize}px; height:${ringSize}px;"></div>
    <div class="hlabel" style="left:${half + 6}px; top:${-half - 4}px; font-size:${fontSize}px;">${p.label ?? ""}</div>
  `;
  dom.overlay.appendChild(marker);

  dom.tableDiv
    .querySelectorAll("tr")
    .forEach((tr) => tr.classList.remove("row-highlight"));
  const tr = dom.tableDiv.querySelector(`tr[data-idx="${idx}"]`);
  if (tr) tr.classList.add("row-highlight");
}

export function highlightAndZoomToIdx(idx) {
  if (!lastPoints || idx < 0 || idx >= lastPoints.length) return;
  highlightPointByIdx(idx);
  enterPointFocus(); // oculta el resto de los puntos hasta "Restablecer puntos en la imagen"
  zoomToPoint(lastPoints[idx], 2.6);
}

export function renderCoverage(points) {
  if (!dom.coverageDiv) return;

  if (!points || points.length === 0) {
    dom.coverageDiv.innerHTML = `
      <div class="card-eyebrow">Cobertura bentónica</div>
      <h2 class="card-title">Porcentaje por categoría</h2>
      <div class="help-text coverage-empty">Aún no hay puntos para calcular el porcentaje de cobertura.</div>
    `;
    return;
  }

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

  const total = points.length;
  const counts = {};
  for (const c of classes) counts[c] = 0;
  for (const p of points) {
    const cls = p.pred_label ?? "";
    counts[cls] = (counts[cls] || 0) + 1;
  }

  const allClasses = Array.from(new Set([...classes, ...Object.keys(counts)]));
  const rows = allClasses
    .map((c) => ({ c, n: counts[c] || 0, pct: ((counts[c] || 0) / total) * 100 }))
    .filter((r) => r.n > 0 || classes.includes(r.c))
    .sort((a, b) => b.pct - a.pct);

  dom.coverageDiv.innerHTML = `
    <div class="card-eyebrow">Cobertura bentónica</div>
    <h2 class="card-title">% por categoría</h2>
    <div class="coverage-list">
      ${rows
        .map(
          (r) => `
        <div class="coverage-row">
          <span class="coverage-label">
            <span class="class-dot" style="background:${classColorVar(r.c)};"></span>
            ${escapeHtml(classDisplayLabel(r.c))}
          </span>
          <div class="coverage-bar-track">
            <div class="coverage-bar-fill" style="width:${r.pct.toFixed(1)}%; background:${classColorVar(r.c)};"></div>
          </div>
          <span class="coverage-pct">${r.pct.toFixed(1)}%</span>
        </div>`
        )
        .join("")}
    </div>
  `;
}

export function renderTable(points) {
  if (!points || points.length === 0) {
    dom.tableDiv.innerHTML = `
      <div class="empty-state">
        ${EMPTY_RESULTS_ICON}
        <p class="empty-state-title">Aún no hay resultados</p>
        <p class="help-text">Sube una imagen y presiona Procesar para ver los puntos etiquetados.</p>
      </div>
    `;
    renderCoverage(points);
    return;
  }

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

  const levels = getDetailLevels();
  const colCount = 5 + (levels.subcategory ? 1 : 0) + (levels.condition ? 1 : 0);

  let html = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Clase</th>
          ${levels.subcategory ? "<th>Subclase</th>" : ""}
          ${levels.condition ? "<th>Estado</th>" : ""}
          <th>Método</th>
          <th>Nota</th>
          <th class="actionCol"></th>
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
        return `<option value="${c}" ${sel}>${escapeHtml(classDisplayLabel(c))}</option>`;
      })
      .join("");

    const method = p.method ?? "automatico";
    const methodBadge =
      method === "manual"
        ? `<span class="badge manual">Manual</span>`
        : `<span class="badge" title="Automático">Auto</span>`;


    const hasNote = !!(p.note && String(p.note).trim());

    html += `
      <tr data-idx="${i}">
        <td class="idCell" style="cursor:pointer; font-weight:700; text-decoration:underline;">
          ${p.label ?? ""}
        </td>
        <td>
          <div class="classCell">
            <span class="class-dot" style="background:${classColorVar(current)};"></span>
            <select class="classSelect" title="${escapeHtml(classDisplayLabel(current))}">${options}</select>
            <span class="confCell">${miniConfHtml(p.confidence)}</span>
          </div>
        </td>
        ${levels.subcategory ? `<td><div class="subclassCell"><input type="text" class="subclassInput" value="${escapeHtml(p.subcategory)}" title="${escapeHtml(p.subcategory)}" placeholder="—" />${miniConfHtml(p.subcategory_confidence)}</div></td>` : ""}
        ${levels.condition ? `<td class="conditionTd">${conditionCellHtml({ ...p, pred_label: current })}</td>` : ""}
        <td class="methodCell">${methodBadge}</td>
        <td>
          <button type="button" class="addNoteBtn${hasNote ? " has-note" : ""}" title="${hasNote ? "Editar nota" : "Agregar nota"}" aria-label="${hasNote ? "Editar nota" : "Agregar nota"}">
            ${hasNote ? NOTE_ICON : PLUS_ICON}
          </button>
        </td>
        <td class="actionCol"><button type="button" class="delBtn" title="Eliminar punto" aria-label="Eliminar punto">${TRASH_ICON}</button></td>
      </tr>
      <tr class="note-row" data-idx="${i}" style="display:${hasNote ? "table-row" : "none"};">
        <td colspan="${colCount}">
          <textarea class="noteTextarea" placeholder="Escribe una nota o anotación para este punto...">${escapeHtml(p.note)}</textarea>
        </td>
      </tr>
    `;
  }

  html += "</tbody></table>";
  dom.tableDiv.innerHTML = html;
  renderCoverage(points);

  // change clase
  dom.tableDiv.querySelectorAll("select.classSelect").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const tr = e.target.closest("tr");
      const idx = Number(tr.dataset.idx);
      const newClass = e.target.value;

      if (!Array.isArray(lastPoints) || idx < 0 || idx >= lastPoints.length)
        return;

      lastPoints[idx].pred_label = newClass;
      // la subcategoría sugerida era de la clase anterior: ya no aplica
      if (lastPoints[idx].subcategory_confidence != null) {
        delete lastPoints[idx].subcategory;
        delete lastPoints[idx].subcategory_confidence;
        const subInput = tr.querySelector("input.subclassInput");
        if (subInput) {
          subInput.value = "";
          subInput.parentElement.querySelector(".conf-badge")?.remove();
        }
      }
      if (newClass !== CONDITION_CLASS) {
        delete lastPoints[idx].condition;
        delete lastPoints[idx].condition_confidence;
      }
      const condTd = tr.querySelector(".conditionTd");
      if (condTd) condTd.innerHTML = conditionCellHtml(lastPoints[idx]);

      lastPoints[idx].method = "manual";
      lastPoints[idx].confidence = null;

      tr.querySelector(".class-dot").style.background = classColorVar(newClass);
      e.target.title = classDisplayLabel(newClass);
      tr.querySelector(".confCell").innerHTML = "";
      tr.querySelector(".methodCell").innerHTML =
        `<span class="badge manual">Manual</span>`;

      renderCoverage(lastPoints);
    });
  });

  // estado del coral (delegado: la celda se re-renderiza al cambiar de clase)
  dom.tableDiv.addEventListener("change", onConditionChange);

  // subclase / nota: se guardan en el punto al escribir
  dom.tableDiv.querySelectorAll("input.subclassInput").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const tr = e.target.closest("tr");
      const idx = Number(tr.dataset.idx);
      if (!Array.isArray(lastPoints) || idx < 0 || idx >= lastPoints.length)
        return;
      lastPoints[idx].subcategory = e.target.value;
      e.target.title = e.target.value;
      // editado a mano: deja de ser sugerencia del modelo
      delete lastPoints[idx].subcategory_confidence;
      e.target.parentElement.querySelector(".conf-badge")?.remove();
    });
  });

  // botón "+" abre/cierra la fila de nota debajo del punto
  dom.tableDiv.querySelectorAll("button.addNoteBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tr = e.currentTarget.closest("tr");
      const idx = Number(tr.dataset.idx);
      const noteRow = dom.tableDiv.querySelector(`tr.note-row[data-idx="${idx}"]`);
      if (!noteRow) return;

      const willShow = noteRow.style.display === "none";
      noteRow.style.display = willShow ? "table-row" : "none";
      if (willShow) noteRow.querySelector("textarea.noteTextarea").focus();
    });
  });

  dom.tableDiv.querySelectorAll("textarea.noteTextarea").forEach((ta) => {
    ta.addEventListener("input", (e) => {
      const tr = e.target.closest("tr");
      const idx = Number(tr.dataset.idx);
      if (!Array.isArray(lastPoints) || idx < 0 || idx >= lastPoints.length)
        return;
      lastPoints[idx].note = e.target.value;

      const btn = dom.tableDiv.querySelector(
        `tr[data-idx="${idx}"]:not(.note-row) button.addNoteBtn`
      );
      if (!btn) return;
      const hasNote = e.target.value.trim().length > 0;
      btn.classList.toggle("has-note", hasNote);
      btn.setAttribute("aria-label", hasNote ? "Editar nota" : "Agregar nota");
      btn.innerHTML = hasNote ? NOTE_ICON : PLUS_ICON;
    });
  });

  // click id highlight + zoom
  dom.tableDiv.querySelectorAll("td.idCell").forEach((td) => {
    td.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      const idx = Number(tr.dataset.idx);
      highlightAndZoomToIdx(idx);
    });
  });

  // delete row
  dom.tableDiv.querySelectorAll("button.delBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      const idx = Number(tr.dataset.idx);
      if (!Array.isArray(lastPoints) || idx < 0 || idx >= lastPoints.length)
        return;

      if (highlightedIdx === idx) {
        dom.overlay.innerHTML = "";
        setHighlightedIdx(-1);
      }
      // los índices se corren al borrar: salir del enfoque sin mover la vista
      if (dom.viewer.classList.contains("focus-mode")) exitPointFocus({ refit: false });

      lastPoints.splice(idx, 1);
      setLastPoints(lastPoints); // mantiene binding consistente
      syncNPointsFromManual();
      renderTable(lastPoints);
      renderAllManualPoints();
      updateManualButtons();
    });
  });
}

function onConditionChange(e) {
  if (!e.target.matches("select.conditionSelect")) return;
  const tr = e.target.closest("tr");
  const idx = Number(tr.dataset.idx);
  if (!Array.isArray(lastPoints) || idx < 0 || idx >= lastPoints.length) return;

  const code = e.target.value;
  if (code) lastPoints[idx].condition = code;
  else delete lastPoints[idx].condition;
  delete lastPoints[idx].condition_confidence;
  e.target.parentElement.querySelector(".conf-badge")?.remove();
  tr.querySelector(".condition-dot").style.background = conditionColorVar(code);
}
