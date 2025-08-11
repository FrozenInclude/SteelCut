function countStackableHBeams(cutterHeight, cutterWidth, H, B, t1, t2) {
    if ([cutterHeight, cutterWidth, H, B, t1, t2].some(v => !Number.isFinite(v) || v <= 0)) return 0;
    const spacingX = t2;                 // ‘안쪽으로 최대 당김’ 배치
    const spacingY = B / 2 + t1 / 2;
    // 빠른 종료: 어떤 행(짝/홀)에서도 가로로 한 개도 못 놓는 경우
    if (H > cutterWidth && spacingX + H > cutterWidth) return 0;
    if (cutterHeight < B) return 0;      // 첫 줄도 못 놓는 경우
    let currentX = 0;
    let currentY = cutterHeight - B;
    let count = 0;
    let row = 0;
    while (currentY >= 0) {
        if (currentX + H <= cutterWidth) {
            count++;
            currentX += H;
            continue;
        }
        row++;
        currentX = (row % 2 === 0) ? 0 : spacingX;
        currentY -= spacingY;
    }
    return count;
}