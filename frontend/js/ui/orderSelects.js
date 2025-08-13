/* eslint-disable no-unused-vars */
import { $, $$ } from '../core/utils.js';
import { getSpecs } from '../services/specRepo.js';

/**
 * 입력 테이블의 제품 select 변경 시, 같은 행의 규격 select를 채움
 * @param {HTMLElement} tbodyEl - 기본 #formRows
 */
export function bindOrderSelects(tbodyEl = $('#formRows')) {
  if (!tbodyEl || tbodyEl.dataset.selectBound === '1') return;
  tbodyEl.dataset.selectBound = '1';

  tbodyEl.addEventListener('change', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLSelectElement)) return;

    const td = target.closest('td');
    if (!td) return;

    // “제품” select가 첫 번째 셀이라고 가정 (cellIndex === 0)
    if (td.cellIndex !== 0) return;

    const tr = target.closest('tr');
    if (!tr) return;

    const selects = tr.querySelectorAll('select');
    const specSelect = selects[1];
    if (!specSelect) return;

    // 옵션 초기화
    specSelect.innerHTML = `<option selected disabled>선택</option>`;

    const product = target.value;
    try {
      const specs = await getSpecs(product);
      (specs || []).forEach((spec) => {
        const opt = document.createElement('option');
        opt.value = spec;
        opt.textContent = spec;
        specSelect.appendChild(opt);
      });
    } catch (err) {
      // services에서 에러가 나도 UI는 조용히 둔다 (필요시 토스트 추가 가능)
      // showToast('규격을 불러오지 못했습니다.', 'danger', 1500);
      console.error('Failed to load specs:', err);
    }
  });
}