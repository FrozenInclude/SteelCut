import { $, format, showToast } from "../core/utils.js";

/**
 * 결과 테이블 렌더링 (같은 sourceIdx 묶어서 번호 셀 rowspan)
 * @param {Array<Object>} results
 * @param {{tbodyEl?: HTMLElement}} [opts]
 */
export function renderResults(results, opts = {}) {
  const tbody = opts.tbodyEl || $("#resultRows");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (!results?.length) {
    tbody.innerHTML = `
      <tr class="text-center text-muted">
        <td colspan="17" class="py-4">결과가 없습니다. 상단에서 항목을 추가하고 ‘계산’을 눌러주세요.</td>
      </tr>`;
    return;
  }

  // keyAt: 그룹 키(sourceIdx → 없으면 i+1)
  const keyAt = (r, i) =>
    r.sourceIdx != null && Number.isFinite(Number(r.sourceIdx))
      ? Number(r.sourceIdx)
      : i + 1;

  // 그룹 크기 계산
  const groupCounts = new Map();
  results.forEach((r, i) => {
    const k = keyAt(r, i);
    groupCounts.set(k, (groupCounts.get(k) || 0) + 1);
  });

  // 렌더
  const renderedInGroup = new Map();
  const frag = document.createDocumentFragment();

  results.forEach((r, i) => {
    const k = keyAt(r, i);
    const count = groupCounts.get(k) || 1;
    const renderedSoFar = renderedInGroup.get(k) || 0;
    const isFirstOfGroup = renderedSoFar === 0;
    renderedInGroup.set(k, renderedSoFar + 1);

    const tr = document.createElement("tr");
    tr.dataset.totalBars = String(r.totalBars || 0);
    tr.dataset.height = String(r.height || 0);

    tr.innerHTML =
      (isFirstOfGroup
        ? `<td class="text-center" rowspan="${count}">${k}</td>`
        : "") +
      `
      <td class="text-center">${r.product || "—"}</td>
      <td class="text-center">${r.spec || "—"}</td>

      <td class="text-center">${format.num(r.rawLen)}</td>
      <td class="text-center">${format.num(r.orderLen)}</td>
      <td class="text-center">${format.num(r.qty)}</td>

      <td class="text-center">${format.num(r.perBarPieces)}</td>
      <td class="text-center">${format.num(r.totalLoss / r.totalBars)}</td>

      <td class="text-center">${format.num(r.totalBars)}</td>
      <td class="text-center">${format.num(r.totalPieces)}</td>
      <td class="text-center">${format.num(r.totalLoss)}</td>
      <td class="text-center">${format.num(r.leftoverBars)}</td>

      <td class="text-center">${format.num(r.height)}</td>
      <td class="text-center">
        <input type="number" class="form-control form-control-sm text-end speed-input"
               value="${r.speed ?? 15}" min="1" step="1" style="max-width:90px;margin:0 auto">
      </td>
      <td class="text-center time-per-bar">${format.num(r.timePerBar, 2)}</td>
      <td class="text-center">${format.num(r.cuts)}</td>
      <td class="text-center total-time">${format.num(r.totalTime, 2)}</td>
    `;
    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
}

/**
 * 상단 합계 카드 렌더링
 * @param {Array<Object>} results
 * @param {{
 *  inputEl?: HTMLElement, piecesEl?: HTMLElement, lossEl?: HTMLElement, timeEl?: HTMLElement
 * }} [els]
 */
export function renderSummary(results, els = {}) {
  const sum = results?.reduce(
    (acc, r) => {
      acc.inputBars += r.totalBars || 0;
      acc.pieces += r.totalPieces || 0;
      acc.loss += r.totalLoss || 0;
      acc.time += r.totalTime || 0;
      return acc;
    },
    { inputBars: 0, pieces: 0, loss: 0, time: 0 }
  ) ?? { inputBars: 0, pieces: 0, loss: 0, time: 0 };

  const inputEl = els.inputEl || $("#sumInputBars");
  const piecesEl = els.piecesEl || $("#sumPieces");
  const lossEl = els.lossEl || $("#sumLoss");
  const timeEl = els.timeEl || $("#sumTime");

  if (inputEl) inputEl.textContent = format.num(sum.inputBars);
  if (piecesEl) piecesEl.textContent = format.num(sum.pieces);
  if (lossEl) lossEl.textContent = format.num(sum.loss);
  if (timeEl) timeEl.textContent = format.num(sum.time, 2);
}

/**
 * 속도 입력 이벤트 바인딩
 * - 결과 테이블 내 .speed-input 변경 시 행/합계 시간 갱신
 */
export function bindSpeedInputs({
  tbodyEl = $("#resultRows"),
  sumTimeEl = $("#sumTime"),
} = {}) {
  if (!tbodyEl || tbodyEl.dataset.bound === "1") return;
  tbodyEl.dataset.bound = "1";

  tbodyEl.addEventListener("input", (e) => {
    const inp = e.target;
    if (
      !(inp instanceof HTMLInputElement) ||
      !inp.classList.contains("speed-input")
    )
      return;

    const tr = inp.closest("tr");
    if (!tr) return;

    const totalBars = Number(tr.dataset.totalBars || 0);
    const height = Number(tr.dataset.height || 0);
    const speed = Number(inp.value) || 0;

    const timePerBar = height && speed ? height / speed : 0;
    const totalTime = timePerBar * totalBars;

    const perCell = tr.querySelector(".time-per-bar");
    const totalCell = tr.querySelector(".total-time");
    if (perCell) perCell.textContent = format.num(timePerBar, 2);
    if (totalCell) totalCell.textContent = format.num(totalTime, 2);

    // 합계 재계산
    let sumTime = 0;
    tbodyEl.querySelectorAll(".total-time").forEach((td) => {
      sumTime += Number(td.textContent?.replace(/,/g, "")) || 0;
    });
    if (sumTimeEl) sumTimeEl.textContent = format.num(sumTime, 2);
  });
}
/** 결과 초기화: 테이블 비우고 합계 0으로, 토스트 표시 */
export function resetResults({
  tbodyEl = $("#resultRows"),
  colspan = 17,
  sumEls = {
    inputEl: $("#sumInputBars"),
    piecesEl: $("#sumPieces"),
    lossEl: $("#sumLoss"),
    timeEl: $("#sumTime"),
  },
} = {}) {
  if (!tbodyEl) return;
  tbodyEl.innerHTML = `
    <tr class="text-center text-muted">
      <td colspan="${colspan}" class="py-4">
        결과가 없습니다. 상단에서 항목을 추가하고 ‘계산’을 눌러주세요.
      </td>
    </tr>`;
  // 합계 0으로
  const { inputEl, piecesEl, lossEl, timeEl } = sumEls;
  if (inputEl) inputEl.textContent = format.num(0);
  if (piecesEl) piecesEl.textContent = format.num(0);
  if (lossEl) lossEl.textContent = format.num(0);
  if (timeEl) timeEl.textContent = format.num(0, 2);

  showToast("모든 항목이 초기화되었습니다.", "success", 1500);
}

/** CSV-safe: 콤마/따옴표 처리 */
function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** 결과 CSV 생성 (헤더 포함) */
export function exportResultsCSV({
  tbodyEl = $("#resultRows"),
  filename = `steelcut_results_${new Date().toISOString().slice(0, 10)}.csv`,
} = {}) {
  if (!tbodyEl) return;

  const rows = [...tbodyEl.querySelectorAll("tr")];
  // placeholder만 있는 경우 방지
  const hasData = rows.some((r) => !r.classList.contains("text-muted"));
  if (!rows.length || !hasData) {
    showToast("내보낼 데이터가 없습니다.", "danger", 1500);
    return;
  }

  const headers = [
    "No",
    "제품",
    "규격",
    "원자재길이",
    "발주길이",
    "수량",
    "본당 절단개수",
    "본당 Loss",
    "총 본수",
    "총 절단개수",
    "총 Loss",
    "잉여 본수",
    "높이",
    "절단속도",
    "분/컷",
    "컷팅수",
    "총 시간",
  ];
  const csv = [headers.map(csvEscape).join(",")];

  rows.forEach((r) => {
    if (r.classList.contains("text-muted")) return; // placeholder skip
    const cells = [...r.querySelectorAll("td")].map((td) =>
      td.textContent.trim()
    );
    csv.push(cells.map(csvEscape).join(","));
  });

  const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 초기화/내보내기 버튼 바인딩 (한 번만) */
export function bindResultsActions({
  resetBtn = $("#resetOrders"),
  exportBtn = $("#exportResults"),
} = {}) {
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.dataset.bound = "1";
    resetBtn.addEventListener("click", () => resetResults());
  }
  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = "1";
    exportBtn.addEventListener("click", () => exportResultsCSV());
  }
}
