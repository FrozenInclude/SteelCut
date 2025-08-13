import { $, format, showToast } from "../core/utils.js";

/** 행 HTML 생성 (내부용) */
function rowHTML({ product, spec, rawLen, orderLen, qty }) {
  const p = product || "—";
  const s = spec || "—";
  const raw = rawLen ? `${format.num(rawLen)} mm` : "—";
  const ord = orderLen ? `${format.num(orderLen)} mm` : "—";
  const q = qty ? `${format.num(qty)} Ea` : "—";

  return `
    <td class="text-center">${p}</td>
    <td class="text-center">${s}</td>
    <td class="text-end">${raw}</td>
    <td class="text-end">${ord}</td>
    <td class="text-end">${q}</td>
    <td class="text-center p-0">
      <button type="button" class="btn btn-danger btn-sm py-0 px-1 fs-7"
              data-action="remove-row">×</button>
    </td>`;
}

/** 발주행 추가 (tbody에 직접 추가) */
export function addRowFromModal(item, tbodyEl = $("#formRows")) {
  if (!tbodyEl) return;
  const tr = document.createElement("tr");
  tr.className = "input-row";

  // dataset 보존 (기존 호출부와 호환)
  tr.dataset.product = item?.product ?? "";
  tr.dataset.spec = item?.spec ?? "";
  tr.dataset.rawLen = item?.rawLen ?? "";
  tr.dataset.orderLen = item?.orderLen ?? "";
  tr.dataset.qty = item?.qty ?? "";

  tr.innerHTML = rowHTML(item ?? {});
  tbodyEl.appendChild(tr);
  return tr;
}

/** 발주행 삭제 (최소 1행 보호) */
export function removeRow(btnEl, tbodyEl = $("#formRows")) {
  const row = btnEl.closest("tr");
  if (!row || !tbodyEl) return;
  const rows = tbodyEl.querySelectorAll("tr");
  if (rows.length > 1) row.remove();
  else showToast("최소 1개의 행은 남겨야 합니다.", "danger", 3000);
}

/** 입력 테이블의 유효 행 수집 */
export function getOrderRows(tbodyEl = $("#formRows")) {
  if (!tbodyEl) return [];
  return [...tbodyEl.querySelectorAll("tr")].filter((tr) => {
    const { product, orderLen, qty } = tr.dataset || {};
    return (
      (product && product !== "—") || Number(orderLen) > 0 || Number(qty) > 0
    );
  });
}

/** 발주 항목 구조화 */
export function readOrderItems(tbodyEl = $("#formRows")) {
  return getOrderRows(tbodyEl).map((tr, idx) => {
    const { product, spec, rawLen, orderLen, qty } = tr.dataset || {};
    return {
      idx: idx + 1,
      product: product || "",
      spec: spec || "",
      rawLen: Number(rawLen) || 0,
      orderLen: Number(orderLen) || 0,
      qty: Number(qty) || 0,
    };
  });
}

/** 삭제 버튼 이벤트 위임 바인딩 */
export function bindRowEvents(tbodyEl = $("#formRows")) {
  if (!tbodyEl) return;
  tbodyEl.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="remove-row"]');
    if (btn) removeRow(btn, tbodyEl);
  });
}
