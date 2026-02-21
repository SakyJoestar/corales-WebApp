export function getBaseName(filename) {
  const justName = (filename || "").split(/[/\\]/).pop();
  const dot = justName.lastIndexOf(".");
  return dot > 0 ? justName.slice(0, dot) : (justName || "imagen");
}

export function sanitizeName(name) {
  return (name || "imagen").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "imagen";
}

export function idxToLabelExcel(idx) {
  let label = "";
  while (idx > 0) {
    idx -= 1;
    label = String.fromCharCode("A".charCodeAt(0) + (idx % 26)) + label;
    idx = Math.floor(idx / 26);
  }
  return label;
}

export function getNextIdx(points) {
  let mx = 0;
  for (const p of (points || [])) {
    const v = Number(p.idx ?? 0);
    if (!Number.isNaN(v)) mx = Math.max(mx, v);
  }
  return mx + 1;
}