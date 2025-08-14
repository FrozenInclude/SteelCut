/* eslint-disable no-unused-vars */
/**
 * presort: 같은 제품+규격끼리 묶고, 그룹 내부에서 정렬
 * - 우선순위: 노컷 > 정확나눔 > 필요길이(내림차순) > 수량(내림차순) > 입력순서
 */
function presortGrouped(items, kerf = 0) {
  // 1) 그룹핑 키: product + spec
  const groups = new Map(); // key -> { items:[], firstIndex:number }
  items.forEach((it, i) => {
    const key = `${it.product || ''}__${it.spec || ''}`;
    if (!groups.has(key)) groups.set(key, { items: [], firstIndex: i });
    groups.get(key).items.push({ ...it, __origIndex: i });
  });

  // 2) 그룹 순서는 "첫 등장 인덱스" 기준 유지 (현장 흐름 보존)
  const orderedGroups = [...groups.entries()].sort(
    (a, b) => a[1].firstIndex - b[1].firstIndex
  );

  // 3) 각 그룹 내부 presort
  const sorted = [];
  for (const [, g] of orderedGroups) {
    const sortedInGroup = g.items
      .map((it) => {
        const raw = Number(it.rawLen) || 0;
        const ord = Number(it.orderLen) || 0;
        const need = ord + kerf;
        return {
          ...it,
          __needLen: need,
          __isNoCut: raw > 0 && ord > 0 && raw === ord,
          __isExact: raw > 0 && need > 0 && raw % need === 0,
        };
      })
      .sort((a, b) => {
        if (a.__isNoCut !== b.__isNoCut) return (b.__isNoCut ? 1 : 0) - (a.__isNoCut ? 1 : 0);
        if (a.__isExact !== b.__isExact) return (b.__isExact ? 1 : 0) - (a.__isExact ? 1 : 0);
        if (a.__needLen !== b.__needLen) return (b.__needLen || 0) - (a.__needLen || 0);
        if (a.qty !== b.qty) return (b.qty || 0) - (a.qty || 0);
        return a.__origIndex - b.__origIndex;
      })
      .map(({ __origIndex, __needLen, __isNoCut, __isExact, ...rest }) => rest);

    sorted.push(...sortedInGroup);
  }

  return sorted;
}

/**
 * 절단 플랜 계산
 * @param {Object} params
 * @param {Array} params.items - { idx, product, spec, rawLen, orderLen, qty }
 * @param {Object} params.settings - { kerf, maxHeight, maxWidth }
 * @param {Object} params.fns - { getStackableCount, getCuttingHeight }
 * @param {('sequence'|'optical')} [params.strategy='sequence']
 *  - sequence: 입력 순서대로
 *  - optical: 제품+규격 그룹별로 presort 후 처리(세팅 변경 최소화 + 그룹 내부 최적)
 */
export function planCutting({
  items,
  settings, // { kerf, maxHeight, maxWidth }
  fns, // { getStackableCount, getCuttingHeight }
  strategy = 'sequence',
}) {
  const { kerf = 0, maxHeight = 0, maxWidth = 0 } = settings || {};
  const { getStackableCount, getCuttingHeight } = fns || {};

  const results = [];
  const warnings = [];

  if (!(maxHeight > 0) || !(maxWidth > 0)) {
    return { results: [], warnings: ['MISSING_CUTTER_SIZE'] };
  }
  if (kerf < 0) {
    return { results: [], warnings: ['NEGATIVE_KERF'] };
  }

  // 전략 적용: optical = 그룹드 presort
  const workItems =
    strategy === 'optical' ? presortGrouped(items || [], kerf) : (items || []);

  // 잔재 관리(동일 product+spec에서만 재사용됨)
  const leftovers = new Map();
  const keyOf = (prod, spec, len) => `${prod}__${spec}__${len}`;
  const putLeftover = (k, cnt) => leftovers.set(k, (leftovers.get(k) || 0) + cnt);
  const takeLeftover = (k, cnt) => {
    const cur = leftovers.get(k) || 0;
    const use = Math.min(cur, cnt);
    if (use > 0) leftovers.set(k, cur - use);
    return use;
  };

  // 사이클(한 번 적재)당 컷팅 수
  const cutsForCycle = (pieces, source, rawLen, orderLen) => {
    if (!pieces || pieces <= 0) return 0;
    if (Number(rawLen) === Number(orderLen)) return 0; // 노컷 → 0
    return pieces + (source === 'raw' ? 1 : 0); // raw는 마지막 kerf 포함
  };

  const defaultSpeed = 15; // 기존 가정 유지

  for (const it of workItems) {
    let remainQty = it.qty;
    if (!(it.rawLen > 0) || !(it.orderLen > 0) || !(remainQty > 0)) continue;

    // 0) 노컷
    if (Number(it.rawLen) === Number(it.orderLen)) {
      const stackable0 = getStackableCount(it.product, it.spec, maxWidth, maxHeight);
      if (stackable0 < 1) {
        warnings.push(`UNSTACKABLE:${it.product} ${it.spec}`);
        continue;
      }
      const barsLoaded0 = Math.min(stackable0, remainQty);
      const height0 = getCuttingHeight(it.product, it.spec, maxWidth, maxHeight, barsLoaded0);

      results.push({
        ...it,
        sourceIdx: it.idx,
        perBarPieces: 1,
        lastBarPieces: 1,
        perBarLoss: 0,
        totalBars: remainQty,
        totalPieces: remainQty,
        totalLoss: 0,
        leftoverBars: 0,
        leftoverLen: 0,
        height: height0,
        speed: 0,
        timePerBar: 0,
        cuts: 0,
        totalTime: 0,
        from: 'no-cut',
        stackable: stackable0,
      });
      continue;
    }

    const perNeedLen = it.orderLen + kerf;
    const stackable = getStackableCount(it.product, it.spec, maxWidth, maxHeight);
    if (stackable < 1) {
      warnings.push(`UNSTACKABLE:${it.product} ${it.spec}`);
      continue;
    }

    // 1) 잔재 먼저 사용
    for (const [k, availableBars] of [...leftovers.entries()]) {
      if (remainQty <= 0) break;
      const [p, s, Ls] = k.split('__');
      if (p !== it.product || s !== it.spec) continue;

      const L = Number(Ls) || 0;
      const ppp = Math.floor(L / perNeedLen);
      if (ppp <= 0) continue;

      const maxPiecesFromThisKey = availableBars * ppp;
      if (maxPiecesFromThisKey <= 0) continue;

      const piecesFromLeftover = Math.min(remainQty, maxPiecesFromThisKey);
      const usedBars = Math.ceil(piecesFromLeftover / ppp);
      const fullBars = Math.max(0, usedBars - 1);
      const lastBarPieces = piecesFromLeftover - fullBars * ppp;

      const actuallyTaken = takeLeftover(k, usedBars);

      // 공통 Push
      const pushResult = (takeBars, pieces, lastPieces2) => {
        const perBarLoss = L - ppp * perNeedLen;

        // 마지막 바가 꽉 차지 않으면 새 잔재 발생
        if (lastPieces2 > 0 && lastPieces2 < ppp) {
          const newLeft = L - lastPieces2 * perNeedLen;
          if (newLeft > 0) putLeftover(keyOf(it.product, it.spec, newLeft), 1);
        }

        const totalBars = takeBars;
        const fullCycles = Math.floor(totalBars / stackable);
        const remBars = totalBars % stackable;

        const hFull =
          fullCycles > 0 ? getCuttingHeight(it.product, it.spec, maxWidth, maxHeight, stackable) : 0;
        const hRem =
          remBars > 0 ? getCuttingHeight(it.product, it.spec, maxWidth, maxHeight, remBars) : 0;

        const tFull = hFull && defaultSpeed ? hFull / defaultSpeed : 0;
        const tRem = hRem && defaultSpeed ? hRem / defaultSpeed : 0;

        const cFull = cutsForCycle(ppp, 'leftover', L, it.orderLen);
        const cRem = remBars > 0 ? cutsForCycle(lastPieces2 || ppp, 'leftover', L, it.orderLen) : 0;

        const cuts = fullCycles * cFull + (remBars > 0 ? cRem : 0);
        const totalTime = fullCycles * (cFull * tFull) + (remBars > 0 ? cRem * tRem : 0);
        const timePerCut = fullCycles > 0 ? tFull : tRem;

        const lossFull = Math.max(0, takeBars - 1) * perBarLoss;
        const lossLast = lastPieces2 > 0 ? L - lastPieces2 * perNeedLen : 0;
        const totalLoss = lossFull + lossLast;

        results.push({
          ...it,
          rawLen: L,
          qty: pieces,
          perBarPieces: ppp,
          lastBarPieces: takeBars <= 1 ? pieces : lastPieces2,
          perBarLoss,
          totalBars,
          totalPieces: pieces,
          totalLoss,
          leftoverBars: 0,
          leftoverLen: 0,
          height: fullCycles > 0 ? hFull : hRem,
          speed: defaultSpeed,
          timePerBar: timePerCut,
          cuts,
          totalTime,
          from: 'leftover',
          stackable,
        });
      };

      if (actuallyTaken < usedBars) {
        // 일부만 확보된 경우
        const piecesFromActuallyTaken =
          actuallyTaken <= 0
            ? 0
            : actuallyTaken === usedBars
              ? piecesFromLeftover
              : Math.max(0, actuallyTaken - 1) * ppp || Math.min(ppp, piecesFromLeftover);

        if (piecesFromActuallyTaken > 0) {
          const fullBars2 = Math.max(0, actuallyTaken - 1);
          const lastPieces2 = piecesFromActuallyTaken - fullBars2 * ppp;
          pushResult(actuallyTaken, piecesFromActuallyTaken, lastPieces2);
          remainQty -= piecesFromActuallyTaken;
        }
        continue;
      }

      // 정상 사용
      pushResult(usedBars, piecesFromLeftover, lastBarPieces);
      remainQty -= piecesFromLeftover;
    }

    // 2) 원자재 사용
    if (remainQty > 0) {
      const ppp = Math.floor(it.rawLen / perNeedLen);
      if (ppp <= 0) {
        warnings.push(`RAW_TOO_SHORT:${it.product} ${it.spec} ${it.rawLen} < ${it.orderLen}+kerf`);
        continue;
      }
      const perBarLoss = it.rawLen - ppp * perNeedLen;

      const usedBars = Math.ceil(remainQty / ppp);
      const fullBars = Math.max(0, usedBars - 1);
      const lastBarPieces = remainQty - fullBars * ppp;

      // 잔재 생성
      if (lastBarPieces > 0 && lastBarPieces < ppp) {
        const newLeft = it.rawLen - lastBarPieces * perNeedLen;
        if (newLeft > 0) putLeftover(keyOf(it.product, it.spec, newLeft), 1);
      } else if (perBarLoss > 0 && usedBars > 0) {
        putLeftover(keyOf(it.product, it.spec, perBarLoss), usedBars);
      }

      // 시간/컷팅
      const totalBars = usedBars;
      const fullCycles = Math.floor(totalBars / stackable);
      const remBars = totalBars % stackable;

      const hFull =
        fullCycles > 0 ? getCuttingHeight(it.product, it.spec, maxWidth, maxHeight, stackable) : 0;
      const hRem =
        remBars > 0 ? getCuttingHeight(it.product, it.spec, maxWidth, maxHeight, remBars) : 0;

      const tFull = hFull && defaultSpeed ? hFull / defaultSpeed : 0;
      const tRem = hRem && defaultSpeed ? hRem / defaultSpeed : 0;

      const cFull = cutsForCycle(ppp, 'raw', it.rawLen, it.orderLen);
      const cRem = remBars > 0 ? cutsForCycle(lastBarPieces || ppp, 'raw', it.rawLen, it.orderLen) : 0;

      const cuts = fullCycles * cFull + (remBars > 0 ? cRem : 0);
      const totalTime = fullCycles * (cFull * tFull) + (remBars > 0 ? cRem * tRem : 0);
      const timePerCut = fullCycles > 0 ? tFull : tRem;

      // 손실
      const lossFull = (lastBarPieces === 0 ? usedBars : usedBars - 1) * perBarLoss;
      const lossLast =
        lastBarPieces > 0 && lastBarPieces < ppp
          ? it.rawLen - lastBarPieces * perNeedLen
          : lastBarPieces === 0
            ? 0
            : perBarLoss;
      const totalLoss = lossFull + lossLast;

      results.push({
        ...it,
        perBarPieces: ppp,
        lastBarPieces: usedBars <= 1 ? remainQty : lastBarPieces,
        perBarLoss,
        totalBars,
        totalPieces: remainQty,
        totalLoss,
        leftoverBars: 0,
        leftoverLen: perBarLoss,
        height: fullCycles > 0 ? hFull : hRem,
        speed: defaultSpeed,
        timePerBar: timePerCut,
        cuts,
        totalTime,
        from: 'raw',
        stackable,
      });

      remainQty = 0;
    }
  }

  return { results, warnings };
}