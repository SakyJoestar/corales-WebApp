import { dom } from "./dom.js";
import { fitToViewerCenter } from "./viewer.js";

// Pares [botón del riel, botón original del sidebar]: el riel solo replica
// clicks y estado disabled/title, la lógica sigue viviendo en el original.
const RAIL_PROXIES = [
  ["railDownloadImgBtn", "downloadImgBtn"],
  ["railDownloadXlsxBtn", "downloadXlsxBtn"],
  ["railHistoryBtn", "historyBtn"],
];

function refitViewerAfterResize() {
  if (!dom.outImg.src) return;
  // el ancho del visor cambia con la transición de la grilla
  requestAnimationFrame(() => fitToViewerCenter());
}

function setCollapsed(collapsed) {
  if (!dom.appGrid) return;
  dom.appGrid.classList.toggle("sidebar-collapsed", collapsed);
  dom.sidebarExpandBtn?.setAttribute("aria-expanded", String(!collapsed));
  dom.sidebarCollapseBtn?.setAttribute("aria-expanded", String(!collapsed));
  refitViewerAfterResize();
}

export function collapseSidebar() {
  setCollapsed(true);
}

export function expandSidebar() {
  setCollapsed(false);
}

export function bindSidebarToggle() {
  dom.sidebarCollapseBtn?.addEventListener("click", collapseSidebar);
  dom.sidebarExpandBtn?.addEventListener("click", expandSidebar);

  dom.appGrid?.addEventListener("transitionend", (e) => {
    if (e.target === dom.appGrid) refitViewerAfterResize();
  });

  for (const [railId, originalId] of RAIL_PROXIES) {
    const railBtn = document.getElementById(railId);
    const original = document.getElementById(originalId);
    if (!railBtn || !original) continue;

    const sync = () => {
      railBtn.disabled = original.disabled;
      railBtn.title = original.title || railBtn.dataset.label;
    };
    sync();
    new MutationObserver(sync).observe(original, {
      attributes: true,
      attributeFilter: ["disabled", "title"],
    });

    railBtn.addEventListener("click", () => original.click());
  }
}
