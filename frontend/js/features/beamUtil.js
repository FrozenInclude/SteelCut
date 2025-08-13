/**
 * 내부 유틸: 양수 숫자 변환(0 이하는 무효 처리용)
 * @param {any} v
 * @returns {number} Number or NaN
 */
function toPositiveNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

/**
 * 규격 문자열 파싱
 * 예: "100*100*6*8" => { H, B, t1, t2 }
 * - 기존과 동일한 반환 형태 보장
 * @param {string} spec
 * @returns {{H:number,B:number,t1:number,t2:number}}
 */
function parseDimsFromSpec(spec) {
  if (!spec || typeof spec !== "string") return { H: 0, B: 0, t1: 0, t2: 0 };
  const parts = spec.split("*").map(Number);
  const [H, B, t1, t2] = parts;
  return {
    H: Number.isFinite(H) ? H : 0,
    B: Number.isFinite(B) ? B : 0,
    t1: Number.isFinite(t1) ? t1 : 0,
    t2: Number.isFinite(t2) ? t2 : 0,
  };
}

/**
 * H형강 적재 시뮬레이션
 * 절단기 크기와 H형강 치수를 받아서 적재 가능한 개수, 층 수, 사용 높이 반환
 * - 반환 객체 키/의미 기존과 동일
 * @param {number} cutterHeight
 * @param {number} cutterWidth
 * @param {number} H
 * @param {number} B
 * @param {number} t1
 * @param {number} t2
 * @returns {{
 *   count:number, rows:number, usedHeight:number,
 *   capEven:number, capOdd:number, spacingY:number, spacingX:number
 * }}
 */
function calcHStack(cutterHeight, cutterWidth, H, B, t1, t2) {
  const hCutter = toPositiveNumber(cutterHeight);
  const wCutter = toPositiveNumber(cutterWidth);
  const h = toPositiveNumber(H);
  const b = toPositiveNumber(B);
  const webT = toPositiveNumber(t1);
  const flangeT = toPositiveNumber(t2);

  if (
    !Number.isFinite(hCutter) ||
    !Number.isFinite(wCutter) ||
    !Number.isFinite(h) ||
    !Number.isFinite(b) ||
    !Number.isFinite(webT) ||
    !Number.isFinite(flangeT)
  ) {
    return { count: 0, rows: 0, usedHeight: 0 };
  }

  // 같은 층 수평 오프셋 / 층간 수직 오프셋 (기존 공식 유지)
  const spacingX = flangeT;
  const spacingY = b / 2 + webT / 2;

  // 아무 행도 못 놓는 경우(가로/세로 빠른 탈락)
  if (h > wCutter && spacingX + h > wCutter) {
    return { count: 0, rows: 0, usedHeight: 0 };
  }
  if (hCutter < b) {
    return { count: 0, rows: 0, usedHeight: 0 };
  }

  // 행별 수용 본수(짝/홀)
  const capEven = Math.floor(wCutter / h);
  const capOdd = Math.floor((wCutter - spacingX) / h);

  let rowsPlaced = 0;
  let count = 0;
  let y = hCutter - b;
  let row = 0;

  // 위에서부터 내려오며 배치(기존 로직 동일)
  while (y >= 0) {
    const cap = row % 2 === 0 ? capEven : capOdd;
    if (cap > 0) {
      rowsPlaced += 1;
      count += cap;
    }
    row += 1;
    y -= spacingY;
  }

  const usedHeight = rowsPlaced > 0 ? b + (rowsPlaced - 1) * spacingY : 0;
  // 확장 정보를 함께 반환(기존 키 외 추가 키는 기존 호출부에 영향 없음)
  return {
    count,
    rows: rowsPlaced,
    usedHeight,
    capEven,
    capOdd,
    spacingY,
    spacingX,
  };
}

/**
 * 절단기 사용 높이 계산
 * - H형강: calcHStack 시뮬레이션 기반
 * - barsLoaded가 주어지면 그 본수로 적재했을 때 높이
 * - 그 외(I형강 등): 설정값 그대로 사용
 * - 반환값/동작 기존과 동일
 * @param {string} product
 * @param {string} spec
 * @param {number} cutterWidth
 * @param {number} cutterHeight
 * @param {number} [barsLoaded]
 * @returns {number}
 */
export function getCuttingHeight(
  product,
  spec,
  cutterWidth,
  cutterHeight,
  barsLoaded
) {
  const HBEAM_RE = /^H형강/;
  if (HBEAM_RE.test(product)) {
    const { H, B, t1, t2 } = parseDimsFromSpec(spec);
    // barsLoaded가 있으면 해당 본수에 맞는 높이, 없으면 풀 적재 높이
    if (Number.isFinite(barsLoaded) && barsLoaded > 0) {
      return (
        getHUsedHeightForCount(
          cutterHeight,
          cutterWidth,
          H,
          B,
          t1,
          t2,
          barsLoaded
        ) || cutterHeight
      );
    }
    const { usedHeight } = calcHStack(cutterHeight, cutterWidth, H, B, t1, t2);
    return usedHeight || cutterHeight;
  }
  // H형강 외: 절단기 높이를 그대로
  return cutterHeight;
}

/**
 * 절단기에서 한 번에 적재 가능한 개수 계산 (H형강 전용)
 * - H형강이면 calcHStack의 count 반환
 * - 나머지는 1(한 번에 한 본)
 * - 시그니처/리턴 기존과 동일
 * @param {string} product
 * @param {string} spec
 * @param {number} cutterWidth
 * @param {number} cutterHeight
 * @returns {number}
 */
export function getStackableCount(product, spec, cutterWidth, cutterHeight) {
  const HBEAM_RE = /^H형강/;
  if (HBEAM_RE.test(product)) {
    const { H, B, t1, t2 } = parseDimsFromSpec(spec);
    return calcHStack(cutterHeight, cutterWidth, H, B, t1, t2).count;
  }
  return 1;
}

/**
 * 원하는 적재 본수(n)에 맞춘 실제 사용 높이(mm)
 * - 반환값/식 동일 유지
 * @param {number} cutterHeight
 * @param {number} cutterWidth
 * @param {number} H
 * @param {number} B
 * @param {number} t1
 * @param {number} t2
 * @param {number} n
 * @returns {number}
 */
function getHUsedHeightForCount(cutterHeight, cutterWidth, H, B, t1, t2, n) {
  const wanted = Number(n);
  if (!Number.isFinite(wanted) || wanted <= 0) return 0;

  const base = calcHStack(cutterHeight, cutterWidth, H, B, t1, t2);
  if (!base.count) return 0;
  if (wanted >= base.count) return base.usedHeight;

  const capEven = Number(base.capEven) || 0;
  const capOdd = Number(base.capOdd) || 0;
  const spacingY = Number(base.spacingY) || B / 2 + t1 / 2;

  if (capEven <= 0 && capOdd <= 0) return 0;

  // 위에서부터 행을 채우며 n개를 배치할 때 필요한 행 수
  let remain = wanted;
  let rowsNeeded = 0;
  let row = 0;
  while (remain > 0) {
    const cap = row % 2 === 0 ? capEven : capOdd;
    if (cap > 0) {
      rowsNeeded += 1;
      remain -= cap;
    }
    row += 1;
  }
  return rowsNeeded > 0 ? B + (rowsNeeded - 1) * spacingY : 0;
}
