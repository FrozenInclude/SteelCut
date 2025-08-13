import { $, format, showToast } from "../core/utils.js";

const EMPTY_ROW_ID = "order-empty-row";
const ORDER_COLSPAN = 6;

// 안내행 표시
function showEmptyRow(tbodyEl = $("#formRows")) {
  if (!tbodyEl) return;
  if (tbodyEl.querySelector(`#${EMPTY_ROW_ID}`)) return;
  const tr = document.createElement("tr");
  tr.id = EMPTY_ROW_ID;
  tr.innerHTML = `
    <td colspan="${ORDER_COLSPAN}" class="py-4 text-center">
      발주 항목이 비어 있습니다. 하단 추가 버튼을 눌러주세요.
    </td>`;
  tbodyEl.appendChild(tr);
}

// 안내행 숨김
function hideEmptyRow(tbodyEl = $("#formRows")) {
  tbodyEl?.querySelector(`#${EMPTY_ROW_ID}`)?.remove();
}

// 실제 데이터 행만 반환
function dataRows(tbodyEl = $("#formRows")) {
  return [...(tbodyEl?.querySelectorAll("tr") || [])].filter(
    (tr) => tr.id !== EMPTY_ROW_ID
  );
}

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

  hideEmptyRow(tbodyEl); // 안내행 숨기기

  const tr = document.createElement("tr");
  tr.className = "input-row";

  // dataset 보존
  tr.dataset.product = item?.product ?? "";
  tr.dataset.spec = item?.spec ?? "";
  tr.dataset.rawLen = item?.rawLen ?? "";
  tr.dataset.orderLen = item?.orderLen ?? "";
  tr.dataset.qty = item?.qty ?? "";

  tr.innerHTML = rowHTML(item ?? {});
  tbodyEl.appendChild(tr);
  return tr;
}

/** 발주행 삭제 (없으면 안내행 표시) */
export function removeRow(btnEl, tbodyEl = $("#formRows")) {
  const row = btnEl.closest("tr");
  if (!row || !tbodyEl) return;

  row.remove();

  if (dataRows(tbodyEl).length === 0) {
    showEmptyRow(tbodyEl);
  }
}

/** 테이블 초기화 */
export function resetOrderTable(tbodyEl = $("#formRows")) {
  if (!tbodyEl) return;
  tbodyEl.innerHTML = "";
  showEmptyRow(tbodyEl);
  showToast("모든 항목이 초기화되었습니다.", "success", 1500);
}

/** 입력 테이블의 유효 행 수집 */
export function getOrderRows(tbodyEl = $("#formRows")) {
  if (!tbodyEl) return [];
  return dataRows(tbodyEl).filter((tr) => {
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

/** 초기 상태 보정 */
export function ensureOrderEmptyState(tbodyEl = $("#formRows")) {
  if (dataRows(tbodyEl).length === 0) showEmptyRow(tbodyEl);
  else hideEmptyRow(tbodyEl);
}

/** 초기화 버튼 연결 */
export function bindResetButton(
  btnEl = $("#resetOrderTable"),
  tbodyEl = $("#formRows")
) {
  if (!btnEl) return;
  btnEl.addEventListener("click", () => resetOrderTable(tbodyEl));
}
