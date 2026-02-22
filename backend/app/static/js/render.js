import { dom } from "./dom.js";
import {
  AVAILABLE_CLASSES,
  lastPoints,
  setLastPoints,
  highlightedIdx,
  setHighlightedIdx,
} from "./state.js";
import { zoomToPoint } from "./viewer.js";
import { updateManualButtons, syncNPointsFromManual } from "./state.js";

export function renderAllManualPoints() {
  dom.overlayAll.innerHTML = "";
  if (!dom.manualMode.checked) return;

  const W = dom.outImg.naturalWidth;
  const H = dom.outImg.naturalHeight;

  const baseSize = Math.max(10, Math.floor(Math.min(W, H) * 0.02));
  const half = Math.floor(baseSize / 2);
  const lineWidth = 2;
  const fontSize = Math.max(14, Math.floor(Math.min(W, H) * 0.02));

  for (const p of lastPoints) {
    const el = document.createElement("div");
    el.className = "point-marker";
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";

    el.innerHTML = `
  <div class="hline" style="width:${baseSize}px; height:${lineWidth}px;"></div>
  <div class="vline" style="width:${lineWidth}px; height:${baseSize}px;"></div>
  <div class="plabel" style="left:${half + 4}px; top:${-half - 2}px; font-size:${fontSize}px;">
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
  const marker = document.createElement("div");
  marker.className = "highlight-marker";
  marker.style.left = p.x + "px";
  marker.style.top = p.y + "px";
  marker.innerHTML = `
    <div class="hline"></div>
    <div class="vline"></div>
    <div class="hlabel">${p.label ?? ""}</div>
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
  zoomToPoint(lastPoints[idx], 2.6);
}

export function renderTable(points) {
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
          <th>método</th>
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

    const method = p.method ?? "automatico";
    const methodBadge =
      method === "manual"
        ? `<span class="badge manual">Manual</span>`
        : `<span class="badge">Automático</span>`;

    html += `
      <tr data-idx="${i}">
        <td class="idCell" style="cursor:pointer; font-weight:700; text-decoration:underline;">
          ${p.label ?? ""}
        </td>
        <td>${p.x}</td>
        <td>${p.y}</td>
        <td><select class="classSelect">${options}</select></td>
        <td class="confCell">${p.confidence != null ? Number(p.confidence).toFixed(3) : ""}</td>
        <td class="methodCell">${methodBadge}</td>
        <td><button type="button" class="delBtn">Eliminar</button></td>
      </tr>
    `;
  }

  html += "</tbody></table>";
  dom.tableDiv.innerHTML = html;

  // change clase
  dom.tableDiv.querySelectorAll("select.classSelect").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const tr = e.target.closest("tr");
      const idx = Number(tr.dataset.idx);
      const newClass = e.target.value;

      if (!Array.isArray(lastPoints) || idx < 0 || idx >= lastPoints.length)
        return;

      lastPoints[idx].pred_label = newClass;

      lastPoints[idx].method = "manual";
      lastPoints[idx].confidence = null;

      tr.querySelector(".confCell").textContent = "";
      tr.querySelector(".methodCell").innerHTML =
        `<span class="badge manual">Manual</span>`;
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

      lastPoints.splice(idx, 1);
      setLastPoints(lastPoints); // mantiene binding consistente
      syncNPointsFromManual();
      renderTable(lastPoints);
      renderAllManualPoints();
      updateManualButtons();
    });
  });
}
