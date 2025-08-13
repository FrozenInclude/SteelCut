export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) =>
  scope.querySelectorAll(selector);

export const format = {
  // ...기존 int, mm, qty, comma 등
  num(num, fixed = null) {
    if (num === null || num === undefined || Number.isNaN(num)) return "—";
    const value = fixed !== null ? Number(num).toFixed(fixed) : num;
    return new Intl.NumberFormat().format(value);
  },
};

/**
 * 토스트 메시지 표시 (Bootstrap alert 기반)
 * @param {string} message - 표시할 메시지
 * @param {string} [type="primary"] - Bootstrap alert 색상 (primary, success, danger 등)
 * @param {number} [duration=1000] - 표시 시간(ms)
 */
export function showToast(message, type = "primary", duration = 1000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.position = "fixed";
    container.style.top = "1rem";
    container.style.right = "1rem";
    container.style.zIndex = "9999";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `alert alert-${type} alert-dismissible fade show`;
  toast.setAttribute("role", "alert");
  toast.style.minWidth = "200px";
  toast.style.marginBottom = "0.5rem";
  toast.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
