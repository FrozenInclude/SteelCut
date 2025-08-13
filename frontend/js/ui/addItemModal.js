/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import { $, showToast } from '../core/utils.js';
import { listProducts, getSpecs, getLengths } from '../services/specRepo.js';
import { addRowFromModal } from './orderTable.js';

/**
 * “발주 항목 추가” 모달 바인딩
 * - 제품/규격/원자재길이 옵션 채우기
 * - 확인 클릭 시 검증 후 행 추가
 */
export function bindAddItemModal({
  modalId = 'addItemModal',
  confirmBtnId = 'modalAddConfirm',
  productSelId = 'modalProduct',
  specSelId = 'modalSpec',
  rawLenSelId = 'modalRawLen',
  orderLenInpId = 'modalOrderLen',
  qtyInpId = 'modalQty',
} = {}) {
  const modalEl = document.getElementById(modalId);
  if (!modalEl) return;

  const confirmBtn = document.getElementById(confirmBtnId);
  const productSel = document.getElementById(productSelId);
  const specSel = document.getElementById(specSelId);
  const rawLenSel = document.getElementById(rawLenSelId);
  const orderLenInp = document.getElementById(orderLenInpId);
  const qtyInp = document.getElementById(qtyInpId);
  const dependentFields = [specSel, rawLenSel, orderLenInp, qtyInp];

  function setEnabled(enabled) {
    dependentFields.forEach((el) => { if (el) el.disabled = !enabled; });
  }
  function populateOptions(select, arr, placeholder) {
    if (!select) return;
    select.innerHTML =
      `<option value="" disabled selected>${placeholder}</option>` +
      (arr || []).map((v) => `<option value="${v}">${v}</option>`).join('');
  }
  function resetDependent() {
    populateOptions(specSel, [], '선택');
    populateOptions(rawLenSel, [], '선택');
    if (orderLenInp) orderLenInp.value = '';
    if (qtyInp) qtyInp.value = 1;
    setEnabled(false);
  }

  async function populateProducts() {
    try {
      const products = await listProducts();
      populateOptions(productSel, products, '선택');
      if (productSel) {
        productSel.disabled = false;
        productSel.value = '';
      }
    } catch (err) {
      console.error('products load failed', err);
      showToast('제품 목록을 불러오지 못했습니다.', 'danger', 1500);
    }
  }

  // 모달 show: 제품 목록 채우고 종속필드 리셋
  modalEl.addEventListener('show.bs.modal', async () => {
    if (productSel && productSel.options.length <= 1) {
      await populateProducts();
    } else if (productSel) {
      productSel.value = '';
      productSel.disabled = false;
    }
    resetDependent();
  });

  // 제품 선택 → 규격/원자재길이 채우기
  productSel?.addEventListener('change', async () => {
    const key = productSel.value;
    try {
      const [specs, lengths] = await Promise.all([getSpecs(key), getLengths(key)]);
      populateOptions(specSel, specs, '선택');
      populateOptions(rawLenSel, lengths, '선택');
      setEnabled(true);
    } catch (err) {
      resetDependent();
      showToast('규격/길이를 불러오지 못했습니다.', 'danger', 1500);
    }
  });

  // 확인 클릭 → 검증 → 행 추가 → 모달 닫기
  confirmBtn?.addEventListener('click', () => {
    const required = (el) => el && !el.disabled;
    [productSel, specSel, rawLenSel, orderLenInp, qtyInp].forEach((el) =>
      el?.classList.remove('is-invalid', 'is-valid'),
    );

    const errs = [];
    if (required(productSel)) {
      const v = (productSel.value || '').trim();
      if (!v) errs.push([productSel, '제품을 선택해주세요.']);
    }
    if (required(specSel)) {
      const v = (specSel.value || '').trim();
      if (!v) errs.push([specSel, '규격을 선택해주세요.']);
    }
    if (required(rawLenSel)) {
      const v = Number(rawLenSel.value);
      if (!Number.isFinite(v) || v <= 0) errs.push([rawLenSel, '원자재길이를 선택하세요.']);
    }
    if (required(orderLenInp)) {
      const v = Number(orderLenInp.value);
      if (!Number.isFinite(v) || v <= 0) errs.push([orderLenInp, '발주길이는 0보다 커야 합니다.']);
    }
    if (required(qtyInp)) {
      const v = Number.parseInt(qtyInp.value, 10);
      if (!Number.isInteger(v) || v <= 0) errs.push([qtyInp, '수량은 1 이상의 정수여야 합니다.']);
    }
    if (Number(rawLenSel?.value) < Number(orderLenInp?.value)) {
      errs.push([orderLenInp, '발주 길이는 원자재 길이보다 클 수 없습니다.']);
    }

    if (errs.length) {
      const [el, msg] = errs[0];
      el?.classList.add('is-invalid');
      el?.focus();
      showToast(msg, 'danger', 1500);
      return;
    }

    addRowFromModal({
      product: (productSel?.value || '').trim(),
      spec: specSel?.disabled ? '' : (specSel?.value || '').trim(),
      rawLen: rawLenSel?.disabled ? null : Number(rawLenSel?.value),
      orderLen: Number(orderLenInp?.value),
      qty: Number.parseInt(qtyInp?.value, 10),
    });

    // Bootstrap 모달 닫기
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();
  });

  // 모달 숨김 후 초기화
  modalEl.addEventListener('hidden.bs.modal', resetDependent);
}
