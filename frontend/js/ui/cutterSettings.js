import { showToast } from "../core/utils.js";

const SETTINGS_KEY = "steelcut.cutterSettings";

// 모듈 상태
let state = {
  kerf: 0,
  maxHeight: 0,
  maxWidth: 0,
  locked: false,
  optimize: false,
};

// 기본 ID들 (applyBtn 제거)
const DEFAULT_IDS = {
  kerf: "kerf",
  maxHeight: "maxHeight",
  maxWidth: "maxWidth",
  lock: "lockSettings",
  optimize: "optimizeOrder",
  resetBtn: "resetSettings",
  form: "inputForm",
};

/** 외부에서 읽기 */
export function getCutterSettings() {
  return { ...state };
}

/** 외부에서 덮어쓰기 + UI 반영 */
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

/** 저장/로드 */
function save(source = "auto") {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
  if (source === "reset") {
    showToast?.("모든 항목이 초기화되었습니다.", "success", 1500);
  } else if (source === "auto") {
    // 자동 저장은 조용히; 필요하면 토스트 켜도 됨
  }
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

/** lock 토글 시 비/활성 */
function setInputsDisabled(disabled, ids = DEFAULT_IDS) {
  // 잠금 시 kerf/maxHeight/maxWidth/optimize 비활성
  ["kerf", "maxHeight", "maxWidth", "optimize"].forEach((k) => {
    const el = document.getElementById(ids[k]);
    if (el) el.disabled = disabled;
  });
}

/** DOM -> state 동기화 */
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

/** 바인딩 (자동저장 모드) */
export function bindCutterSettings(ids = DEFAULT_IDS) {
  const root = document.getElementById(ids.form) || document;
  if (root.dataset.cutterBound === "1") return;
  root.dataset.cutterBound = "1";

  const $kerf = document.getElementById(ids.kerf);
  const $maxH = document.getElementById(ids.maxHeight);
  const $maxW = document.getElementById(ids.maxWidth);
  const $lock = document.getElementById(ids.lock);
  const $opt = document.getElementById(ids.optimize);
  const $reset = document.getElementById(ids.resetBtn);

  // 최초 로드 → UI 반영
  load(ids);

  // 값 변경 → state 갱신 + 즉시 저장
  [$kerf, $maxH, $maxW].forEach((el) => {
    el?.addEventListener("change", () => {
      readFromInputs(ids);
      save("auto");
    });
  });

  // lock 변경 → 입력칸 토글 + 저장
  $lock?.addEventListener("change", (e) => {
    setInputsDisabled(!!e.target.checked, ids);
    readFromInputs(ids);
    save("auto");
  });

  // optimize 변경 → 저장
  $opt?.addEventListener("change", () => {
    readFromInputs(ids);
    save("auto");
  });

  // 리셋 버튼 → 기본값으로 세팅 + 저장
  $reset?.addEventListener("click", () => {
    setCutterSettings(
      { kerf: 0, maxHeight: 0, maxWidth: 0, locked: false, optimize: false },
      ids
    );
    // state 업데이트 후 저장
    readFromInputs(ids);
    save("reset");
  });
}