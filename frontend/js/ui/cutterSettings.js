import { showToast } from "../core/utils.js";

const SETTINGS_KEY = "steelcut.cutterSettings";

// 모듈 내부 상태
let state = { kerf: 0, maxHeight: 0, maxWidth: 0, locked: false };

// 선택자 기본값
const DEFAULT_IDS = {
  kerf: "kerf",
  maxHeight: "maxHeight",
  maxWidth: "maxWidth",
  lock: "lockSettings",
  applyBtn: "applySettings",
  resetBtn: "resetSettings",
  form: "inputForm",
};

/** 외부에서 읽을 수 있게 제공 */
export function getCutterSettings() {
  return { ...state };
}

/**외부에서 설정을 집어넣어 UI에도 반영 */
export function setCutterSettings(next, ids = DEFAULT_IDS) {
  state = { ...state, ...next };
  const $kerf = document.getElementById(ids.kerf);
  const $maxH = document.getElementById(ids.maxHeight);
  const $maxW = document.getElementById(ids.maxWidth);
  const $lock = document.getElementById(ids.lock);

  if ($kerf) $kerf.value = state.kerf ?? "";
  if ($maxH) $maxH.value = state.maxHeight ?? "";
  if ($maxW) $maxW.value = state.maxWidth ?? "";
  if ($lock) {
    $lock.checked = !!state.locked;
    setInputsDisabled($lock.checked, ids);
  }
}

/** 로컬스토리지 저장/로드 */
function save(ids, source = "auto") {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
  if (source === "apply")
    showToast?.("절단기 설정이 적용되었습니다.", "success", 1500);
}
function load(ids) {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!saved) return;
    setCutterSettings(saved, ids);
  } catch (e) {
    console.warn("설정 로드 실패", e);
  }
}

/** 입력칸 활성/비활성 */
function setInputsDisabled(disabled, ids = DEFAULT_IDS) {
  ["kerf", "maxHeight", "maxWidth"].forEach((k) => {
    const el = document.getElementById(ids[k]);
    if (el) el.disabled = disabled;
  });
}

/** DOM → state */
function readFromInputs(ids = DEFAULT_IDS) {
  const $kerf = document.getElementById(ids.kerf);
  const $maxH = document.getElementById(ids.maxHeight);
  const $maxW = document.getElementById(ids.maxWidth);
  const $lock = document.getElementById(ids.lock);
  state = {
    kerf: Number($kerf?.value) || 0,
    maxHeight: Number($maxH?.value) || 0,
    maxWidth: Number($maxW?.value) || 0,
    locked: !!$lock?.checked,
  };
}

/**
 * 한 번만 바인딩
 * - apply/reset 클릭
 * - 각 입력 change
 * - lock 변경 시 비/활성
 * - 초기 로드
 */
export function bindCutterSettings(ids = DEFAULT_IDS) {
  const root = document.getElementById(ids.form) || document;
  if (root.dataset.cutterBound === "1") return;
  root.dataset.cutterBound = "1";

  const $kerf = document.getElementById(ids.kerf);
  const $maxH = document.getElementById(ids.maxHeight);
  const $maxW = document.getElementById(ids.maxWidth);
  const $lock = document.getElementById(ids.lock);
  const $apply = document.getElementById(ids.applyBtn);
  const $reset = document.getElementById(ids.resetBtn);

  // 초기 로드
  load(ids);

  // change → state 저장
  [$kerf, $maxH, $maxW].forEach((el) => {
    el?.addEventListener("change", () => {
      readFromInputs(ids);
      save(ids, "auto");
    });
  });

  // lock 체크 → 입력칸 토글 + 저장
  $lock?.addEventListener("change", (e) => {
    setInputsDisabled(!!e.target.checked, ids);
    readFromInputs(ids);
    save(ids, "auto");
  });

  // 적용 버튼 → 저장 + 토스트
  $apply?.addEventListener("click", () => {
    readFromInputs(ids);
    save(ids, "apply");
  });

  // 리셋 버튼 → 입력 초기화 + 저장
  $reset?.addEventListener("click", () => {
    setCutterSettings(
      { kerf: 0, maxHeight: 0, maxWidth: 0, locked: false },
      ids
    );
    showToast?.("모든 항목이 초기화되었습니다.", "success", 1500);
  });

  // 제출 이벤트 훅(필요 없으면 제거 가능)
  document.getElementById(ids.form)?.addEventListener("submit", () => {});
}
