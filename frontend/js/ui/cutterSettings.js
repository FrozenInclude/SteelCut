import { showToast } from "../core/utils.js";

const SETTINGS_KEY = "steelcut.cutterSettings";

// 모듈 내부 상태
let state = {
  kerf: 0,
  maxHeight: 0,
  maxWidth: 0,
  locked: false,
  optimize: false,
};

// 선택자 기본값
const DEFAULT_IDS = {
  kerf: "kerf",
  maxHeight: "maxHeight",
  maxWidth: "maxWidth",
  lock: "lockSettings",
  optimize: "optimizeOrder",
  applyBtn: "applySettings",
  resetBtn: "resetSettings",
  form: "inputForm",
};

/** 외부에서 읽을 수 있게 제공 */
export function getCutterSettings() {
  return { ...state };
}

/** 외부에서 설정을 집어넣어 UI에도 반영 */
export function setCutterSettings(next, ids = DEFAULT_IDS) {
  state = { ...state, ...next };
  const $kerf = document.getElementById(ids.kerf);
  const $maxH = document.getElementById(ids.maxHeight);
  const $maxW = document.getElementById(ids.maxWidth);
  const $lock = document.getElementById(ids.lock);
  const $opt = document.getElementById(ids.optimize);

  if ($kerf) $kerf.value = state.kerf ?? "";
  if ($maxH) $maxH.value = state.maxHeight ?? "";
  if ($maxW) $maxW.value = state.maxWidth ?? "";
  if ($lock) {
    $lock.checked = !!state.locked;
    setInputsDisabled($lock.checked, ids);
  }
  if ($opt) $opt.checked = !!state.optimize;
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

/** 입력칸 활성/비활성 (lock 토글용) */
function setInputsDisabled(disabled, ids = DEFAULT_IDS) {
  ["kerf", "maxHeight", "maxWidth", "optimize"].forEach((k) => {
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
  const $opt = document.getElementById(ids.optimize);
  state = {
    kerf: Number($kerf?.value) || 0,
    maxHeight: Number($maxH?.value) || 0,
    maxWidth: Number($maxW?.value) || 0,
    locked: !!$lock?.checked,
    optimize: !!$opt?.checked,
  };
}

/**
 * 한 번만 바인딩
 * - apply/reset 클릭
 * - 각 입력 change
 * - lock/optimize 변경 시 저장
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
  const $opt = document.getElementById(ids.optimize);
  const $apply = document.getElementById(ids.applyBtn);
  const $reset = document.getElementById(ids.resetBtn);

  // 초기 로드
  load(ids);

  [$kerf, $maxH, $maxW].forEach((el) => {
    el?.addEventListener("change", () => {
      readFromInputs(ids);
    });
  });

  $lock?.addEventListener("change", (e) => {
    setInputsDisabled(!!e.target.checked, ids);
    readFromInputs(ids);
  });

  $opt?.addEventListener("change", () => {
    readFromInputs(ids);
  });

  $apply?.addEventListener("click", () => {
    readFromInputs(ids);
    save(ids, "apply");
  });

  $reset?.addEventListener("click", () => {
    setCutterSettings(
      { kerf: 0, maxHeight: 0, maxWidth: 0, locked: false, optimize: false },
      ids
    );
    showToast?.("모든 항목이 초기화되었습니다.", "success", 1500);
  });

  document.getElementById(ids.form)?.addEventListener("submit", () => {});
}
