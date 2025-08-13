// ./js/main.js
/**
 * SteelCut 엔트리 (UI 바인딩/흐름 제어)
 * - 계산 로직: ./features/*
 * - 데이터 소스: ./services/*
 * - UI 세부: ./ui/*
 * - 공용 유틸: ./core/*
 */

import { showToast } from "./core/utils.js";
import { focusSettingInput } from "./ui/settings.js";

import { bindOrderSelects } from "./ui/orderSelects.js";
import { bindAddItemModal } from "./ui/addItemModal.js";
import { readOrderItems, bindRowEvents } from "./ui/orderTable.js";

import {
  renderResults,
  renderSummary,
  bindSpeedInputs,
  bindResultsActions,
} from "./ui/results.js";

import { bindCutterSettings, getCutterSettings } from "./ui/cutterSettings.js";

import { planCutting } from "./features/plan.js";
import { getStackableCount, getCuttingHeight } from "./features/beamUtil.js";

/* ------------------------------
 * 초기화
 * ------------------------------ */
function init() {
  // 설정(스토리지 로드 & 입력 바인딩)
  bindCutterSettings();

  // 입력 테이블: 행 삭제 위임 + 제품/규격 셀렉트 연동
  bindRowEvents();
  bindOrderSelects();

  // 모달: 발주 항목 추가
  bindAddItemModal();

  // 결과 테이블: 속도 입력, 초기화/CSV 내보내기 버튼
  bindSpeedInputs();
  bindResultsActions();

  // 계산 버튼/폼 제출 트리거
  wireCalculate();
}

/* ------------------------------
 * 계산 트리거 바인딩
 * ------------------------------ */
function wireCalculate() {
  const calcBtn = document.getElementById("calcBtn"); // 없으면 무시
  const form = document.getElementById("inputForm");

  calcBtn?.addEventListener("click", onCalculate);
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    onCalculate();
  });
}

/* ------------------------------
 * 핵심 계산 (컨트롤러)
 * ------------------------------ */
function onCalculate() {
  const items = readOrderItems();
  if (!items.length) {
    showToast("발주 항목을 추가해주세요.", "danger", 1500);
    return;
  }

  const settings = getCutterSettings();

  const { results, warnings } = planCutting({
    items,
    settings,
    fns: { getStackableCount, getCuttingHeight },
  });

  // 경고 처리(토스트/포커스는 컨트롤러에서 담당)
  if (warnings?.includes("MISSING_CUTTER_SIZE")) {
    showToast(
      "절단기 설정(최대 높이/넓이)을 먼저 입력·적용하세요.",
      "danger",
      2000
    );
    if (!(settings.maxHeight > 0)) focusSettingInput("maxHeight");
    else focusSettingInput("maxWidth");
    return;
  }
  if (warnings?.includes("NEGATIVE_KERF")) {
    showToast("톱손실(Kerf)은 0 이상이어야 합니다.", "danger", 2000);
    focusSettingInput("kerf");
    return;
  }
  (warnings || []).forEach((w) => {
    if (w.startsWith("UNSTACKABLE:")) {
      const msg = w.split(":")[1];
      showToast(`${msg} 절단기 적재 불가(폭/배치 조건).`, "danger", 2500);
    }
    if (w.startsWith("RAW_TOO_SHORT:")) {
      const msg = w.split(":")[1];
      showToast(`${msg} 원자재 길이 부족.`, "danger", 2500);
    }
  });

  // 렌더
  renderResults(results);
  renderSummary(results);
}

window.addEventListener("DOMContentLoaded", init);
