export function planCutting({
  items,
  settings, // { kerf, maxHeight, maxWidth }
  fns, // { getStackableCount, getCuttingHeight }
}) {
  const { kerf = 0, maxHeight = 0, maxWidth = 0 } = settings || {};
  const { getStackableCount, getCuttingHeight } = fns;

  const results = [];
  const warnings = []; // 문자열 메시지(컨트롤러에서 토스트)

  if (!(maxHeight > 0) || !(maxWidth > 0)) {
    return { results: [], warnings: ["MISSING_CUTTER_SIZE"] };
  }
  if (kerf < 0) {
    return { results: [], warnings: ["NEGATIVE_KERF"] };
  }

  const leftovers = new Map();
  const keyOf = (prod, spec, len) => `${prod}__${spec}__${len}`;
  const putLeftover = (k, cnt) =>
    leftovers.set(k, (leftovers.get(k) || 0) + cnt);
  const takeLeftover = (k, cnt) => {
    const cur = leftovers.get(k) || 0;
    const use = Math.min(cur, cnt);
    if (use > 0) leftovers.set(k, cur - use);
    return use;
  };

  const cutsForCycle = (pieces, source, rawLen, orderLen) => {
    if (!pieces || pieces <= 0) return 0;
    if (Number(rawLen) === Number(orderLen)) return 0; // 노컷
    return pieces + (source === "raw" ? 1 : 0);
  };

  for (const it of items) {
    let remainQty = it.qty;
    if (!(it.rawLen > 0) || !(it.orderLen > 0) || !(remainQty > 0)) continue;

    // 노컷
    if (Number(it.rawLen) === Number(it.orderLen)) {
      const stackable0 = getStackableCount(
        it.product,
        it.spec,
        maxWidth,
        maxHeight
      );
      if (stackable0 < 1) {
        warnings.push(`UNSTACKABLE:${it.product} ${it.spec}`);
        continue;
      }
      const barsLoaded0 = Math.min(stackable0, remainQty);
      const height0 = getCuttingHeight(
        it.product,
        it.spec,
        maxWidth,
        maxHeight,
        barsLoaded0
      );

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
        from: "no-cut",
        stackable: stackable0,
      });
      continue;
    }

    const perNeedLen = it.orderLen + kerf;
    const stackable = getStackableCount(
      it.product,
      it.spec,
      maxWidth,
      maxHeight
    );
    if (stackable < 1) {
      warnings.push(`UNSTACKABLE:${it.product} ${it.spec}`);
      continue;
    }
    const defaultSpeed = 15;

    // --- 1) 잔재 사용 (필요 만큼) ---
    for (const [k, availableBars] of [...leftovers.entries()]) {
      if (remainQty <= 0) break;
      const [p, s, Ls] = k.split("__");
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
      const apply = (takeBars, pieces) => {
        if (takeBars <= 0 || pieces <= 0) return;

        const fullBars2 = Math.max(0, takeBars - 1);
        const lastPieces2 = pieces - fullBars2 * ppp;

        const perBarLoss = L - ppp * perNeedLen;
        const lossFull = fullBars2 * perBarLoss;
        const lossLast = lastPieces2 > 0 ? L - lastPieces2 * perNeedLen : 0;
        const totalLoss = lossFull + lossLast;

        if (lastPieces2 > 0 && lastPieces2 < ppp) {
          const newLeft = L - lastPieces2 * perNeedLen;
          if (newLeft > 0) putLeftover(keyOf(it.product, it.spec, newLeft), 1);
        }

        const totalBars = takeBars;
        const fullCycles = Math.floor(totalBars / stackable);
        const remBars = totalBars % stackable;

        const hFull =
          fullCycles > 0
            ? getCuttingHeight(
                it.product,
                it.spec,
                maxWidth,
                maxHeight,
                stackable
              )
            : 0;
        const hRem =
          remBars > 0
            ? getCuttingHeight(
                it.product,
                it.spec,
                maxWidth,
                maxHeight,
                remBars
              )
            : 0;

        const timePerCutFull = hFull && defaultSpeed ? hFull / defaultSpeed : 0;
        const timePerCutRem = hRem && defaultSpeed ? hRem / defaultSpeed : 0;

        const cutsPerCycleFull = cutsForCycle(ppp, "leftover", L, it.orderLen);
        const lastPiecesForRem =
          remBars > 0 ? (lastPieces2 > 0 ? lastPieces2 : ppp) : 0;
        const cutsPerCycleRem =
          remBars > 0
            ? cutsForCycle(lastPiecesForRem, "leftover", L, it.orderLen)
            : 0;

        const cuts =
          fullCycles * cutsPerCycleFull + (remBars > 0 ? cutsPerCycleRem : 0);
        const totalTime =
          fullCycles * (cutsPerCycleFull * timePerCutFull) +
          (remBars > 0 ? cutsPerCycleRem * timePerCutRem : 0);
        const timePerCut = fullCycles > 0 ? timePerCutFull : timePerCutRem;

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
          from: "leftover",
          stackable,
        });
      };

      if (actuallyTaken < usedBars) {
        const piecesFromActuallyTaken =
          actuallyTaken <= 0
            ? 0
            : actuallyTaken === usedBars
              ? piecesFromLeftover
              : Math.max(0, actuallyTaken - 1) * ppp ||
                Math.min(ppp, piecesFromLeftover);

        apply(actuallyTaken, piecesFromActuallyTaken);
        remainQty -= piecesFromActuallyTaken;
        continue;
      }

      // 정상 사용
      const perBarLoss = L - ppp * perNeedLen;
      const lossFull =
        (lastBarPieces === 0 ? usedBars : usedBars - 1) * perBarLoss;
      const lossLast =
        lastBarPieces > 0 && lastBarPieces < ppp
          ? L - lastBarPieces * perNeedLen
          : lastBarPieces === 0
            ? 0
            : perBarLoss;
      const totalLoss = lossFull + lossLast;

      if (lastBarPieces > 0 && lastBarPieces < ppp) {
        const newLeft = L - lastBarPieces * perNeedLen;
        if (newLeft > 0) putLeftover(keyOf(it.product, it.spec, newLeft), 1);
      }

      // 동일 계산 적용
      const totalBars = usedBars;
      const fullCycles = Math.floor(totalBars / stackable);
      const remBars = totalBars % stackable;
      const hFull =
        fullCycles > 0
          ? getCuttingHeight(
              it.product,
              it.spec,
              maxWidth,
              maxHeight,
              stackable
            )
          : 0;
      const hRem =
        remBars > 0
          ? getCuttingHeight(it.product, it.spec, maxWidth, maxHeight, remBars)
          : 0;
      const tFull = hFull && defaultSpeed ? hFull / defaultSpeed : 0;
      const tRem = hRem && defaultSpeed ? hRem / defaultSpeed : 0;
      const cFull = cutsForCycle(ppp, "leftover", L, it.orderLen);
      const cRem =
        remBars > 0
          ? cutsForCycle(lastBarPieces || ppp, "leftover", L, it.orderLen)
          : 0;
      const cuts = fullCycles * cFull + (remBars > 0 ? cRem : 0);
      const totalTime =
        fullCycles * (cFull * tFull) + (remBars > 0 ? cRem * tRem : 0);
      const timePerCut = fullCycles > 0 ? tFull : tRem;

      results.push({
        ...it,
        rawLen: L,
        qty: piecesFromLeftover,
        perBarPieces: ppp,
        lastBarPieces: usedBars <= 1 ? piecesFromLeftover : lastBarPieces,
        perBarLoss,
        totalBars,
        totalPieces: piecesFromLeftover,
        totalLoss,
        leftoverBars: 0,
        leftoverLen: 0,
        height: fullCycles > 0 ? hFull : hRem,
        speed: defaultSpeed,
        timePerBar: timePerCut,
        cuts,
        totalTime,
        from: "leftover",
        stackable,
      });

      remainQty -= piecesFromLeftover;
    }

    // --- 2) 원자재 ---
    if (remainQty > 0) {
      const ppp = Math.floor(it.rawLen / perNeedLen);
      if (ppp <= 0) {
        warnings.push(
          `RAW_TOO_SHORT:${it.product} ${it.spec} ${it.rawLen} < ${it.orderLen}+kerf`
        );
        continue;
      }
      const perBarLoss = it.rawLen - ppp * perNeedLen;

      const usedBars = Math.ceil(remainQty / ppp);
      const fullBars = Math.max(0, usedBars - 1);
      const lastBarPieces = remainQty - fullBars * ppp;

      const lossFull =
        (lastBarPieces === 0 ? usedBars : usedBars - 1) * perBarLoss;
      const lossLast =
        lastBarPieces > 0 && lastBarPieces < ppp
          ? it.rawLen - lastBarPieces * perNeedLen
          : lastBarPieces === 0
            ? 0
            : perBarLoss;
      const totalLoss = lossFull + lossLast;

      if (lastBarPieces > 0 && lastBarPieces < ppp) {
        const newLeft = it.rawLen - lastBarPieces * perNeedLen;
        if (newLeft > 0) putLeftover(keyOf(it.product, it.spec, newLeft), 1);
      } else if (perBarLoss > 0 && usedBars > 0) {
        putLeftover(keyOf(it.product, it.spec, perBarLoss), usedBars);
      }

      const totalBars = usedBars;
      const fullCycles = Math.floor(totalBars / stackable);
      const remBars = totalBars % stackable;
      const hFull =
        fullCycles > 0
          ? getCuttingHeight(
              it.product,
              it.spec,
              maxWidth,
              maxHeight,
              stackable
            )
          : 0;
      const hRem =
        remBars > 0
          ? getCuttingHeight(it.product, it.spec, maxWidth, maxHeight, remBars)
          : 0;
      const tFull = hFull && defaultSpeed ? hFull / defaultSpeed : 0;
      const tRem = hRem && defaultSpeed ? hRem / defaultSpeed : 0;
      const cFull = cutsForCycle(ppp, "raw", it.rawLen, it.orderLen);
      const cRem =
        remBars > 0
          ? cutsForCycle(lastBarPieces || ppp, "raw", it.rawLen, it.orderLen)
          : 0;
      const cuts = fullCycles * cFull + (remBars > 0 ? cRem : 0);
      const totalTime =
        fullCycles * (cFull * tFull) + (remBars > 0 ? cRem * tRem : 0);
      const timePerCut = fullCycles > 0 ? tFull : tRem;

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
        from: "raw",
        stackable,
      });

      remainQty = 0;
    }
  }

  return { results, warnings };
}
