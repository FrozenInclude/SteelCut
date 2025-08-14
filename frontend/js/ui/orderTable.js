import { $, format, showToast } from "../core/utils.js";

const EMPTY_ROW_ID = "order-empty-row";
const ORDER_COLSPAN = 6;
const ORDERS_KEY = "steelcut.orderItems:v1"; // 로컬스토리지 키 (버전 포함 권장)

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
      <button type="button" class="btn btn-danger btn-sm py-0 px-1 fs-6.5"
              data-action="remove-row">×</button>
    </td>`;
}

/* =========================
 * 로컬스토리지(자동 저장/복원)
 * ========================= */

/** tbody → JSON 직렬화 */
function serializeRows(tbodyEl = $("#formRows")) {
  return dataRows(tbodyEl).map((tr, i) => {
    const { product, spec, rawLen, orderLen, qty } = tr.dataset || {};
    return {
      idx: i + 1,
      product: product || "",
      spec: spec || "",
      rawLen: Number(rawLen) || 0,
      orderLen: Number(orderLen) || 0,
      qty: Number(qty) || 0,
    };
  });
}

/** JSON → tbody에 렌더 */
function applyRows(items = [], tbodyEl = $("#formRows")) {
  if (!tbodyEl) return;
  tbodyEl.innerHTML = "";
  if (!items.length) {
    showEmptyRow(tbodyEl);
    return;
  }
  hideEmptyRow(tbodyEl);
  const frag = document.createDocumentFragment();
  for (const it of items) {
    const tr = document.createElement("tr");
    tr.className = "input-row";
    tr.dataset.product = it.product ?? "";
    tr.dataset.spec = it.spec ?? "";
    tr.dataset.rawLen = it.rawLen ?? "";
    tr.dataset.orderLen = it.orderLen ?? "";
    tr.dataset.qty = it.qty ?? "";
    tr.innerHTML = rowHTML(it);
    frag.appendChild(tr);
  }
  tbodyEl.appendChild(frag);
}

/** 저장 */
function saveOrders(tbodyEl = $("#formRows")) {
  const payload = { v: 1, items: serializeRows(tbodyEl) };
  localStorage.setItem(ORDERS_KEY, JSON.stringify(payload));
}

/** 복원 */
export function loadOrders(tbodyEl = $("#formRows")) {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) {
      ensureOrderEmptyState(tbodyEl);
      return;
    }
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    applyRows(items, tbodyEl);
  } catch (e) {
    console.warn("발주 항목 로드 실패", e);
    ensureOrderEmptyState(tbodyEl);
  }
}

/** 다른 탭에서 변경될 때 동기화*/
export function bindOrderPersistence(tbodyEl = $("#formRows")) {
  // 최초 로드
  loadOrders(tbodyEl);

  // storage 이벤트(다른 탭/창 동기화)
  window.addEventListener("storage", (e) => {
    if (e.key === ORDERS_KEY) loadOrders(tbodyEl);
  });
}

/* =========================
 * 공개 API (행 추가/삭제/초기화/읽기)
 * ========================= */

/** 발주행 추가 (tbody에 직접 추가) */
export function addRowFromModal(item, tbodyEl = $("#formRows")) {
  if (!tbodyEl) return;

  hideEmptyRow(tbodyEl);

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

  // 자동 저장
  saveOrders(tbodyEl);
  return tr;
}

/** 발주행 삭제 (없으면 안내행 표시) */
export function removeRow(btnEl, tbodyEl = $("#formRows")) {
  const row = btnEl.closest("tr");
  if (!row || !tbodyEl) return;

  row.remove();
  if (dataRows(tbodyEl).length === 0) showEmptyRow(tbodyEl);

  // 자동 저장
  saveOrders(tbodyEl);
}

/** 테이블 초기화 */
export function resetOrderTable(tbodyEl = $("#formRows")) {
  if (!tbodyEl) return;
  tbodyEl.innerHTML = "";
  showEmptyRow(tbodyEl);

  // 자동 저장(빈 상태)
  saveOrders(tbodyEl);

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
  return serializeRows(tbodyEl); // 직렬화 로직과 동일
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