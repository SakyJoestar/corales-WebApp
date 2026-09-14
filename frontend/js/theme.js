const STORAGE_KEY = "coral-theme";

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  document.documentElement.dataset.theme = saved === "dark" ? "dark" : "light";
}

export function bindThemeToggle(btn) {
  btn.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(STORAGE_KEY, next);
  });
}
