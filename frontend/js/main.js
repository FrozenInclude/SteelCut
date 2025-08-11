function addRowFromModal({ product, spec, rawLen, orderLen, qty }) {
    const tbody = document.getElementById('formRows');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = 'input-row';
    // 이후 계산/수정 대비해 데이터도 심어둠
    tr.dataset.product = product ?? '';
    tr.dataset.spec = spec ?? '';
    tr.dataset.rawLen = rawLen ?? '';
    tr.dataset.orderLen = orderLen ?? '';
    tr.dataset.qty = qty ?? '';

    const fmt = (v, unit = '') => (v === null || v === undefined || v === '' || Number.isNaN(v))
        ? '—'
        : `${v}${unit ? ' ' + unit : ''}`;

    tr.innerHTML = `
      <td class="text-center">${product || '—'}</td>
      <td class="text-center">${spec || '—'}</td>
      <td class="text-end">${fmt(rawLen, 'mm')}</td>
      <td class="text-end">${fmt(orderLen, 'mm')}</td>
      <td class="text-end">${fmt(qty, 'Ea')}</td>
      <td class="text-center p-0">
        <button type="button" class="btn btn-danger btn-sm py-0 px-1 fs-7" onclick="removeRow(this)">×</button>
      </td>
    `;
    tbody.appendChild(tr);
}

function removeRow(button) {
    const row = button.closest('tr');
    const tbody = document.getElementById('formRows');
    if (tbody.querySelectorAll('tr').length > 1) {
        row.remove();
    }
    else {
        showToast('최소 1개의 행은 남겨야 합니다.', 'danger', 3000)
    }
}

// 규격 자동 선택
document.addEventListener("change", function (e) {
    if (e.target.tagName === "SELECT" && e.target.closest("td").cellIndex === 0) {
        const itemType = e.target.value;
        const specSelect = e.target.closest("tr").querySelectorAll("select")[1];
        specSelect.innerHTML = `<option selected disabled>선택</option>`;
        (steelSpecs[itemType] || []).forEach(spec => {
            const opt = document.createElement("option");
            opt.value = spec;
            opt.textContent = spec;
            specSelect.appendChild(opt);
        });
    }
});

(function () {
    const SETTINGS_KEY = 'steelcut.cutterSettings';
    const $kerf = document.getElementById('kerf');
    const $maxHeight = document.getElementById('maxHeight');
    const $maxWidth = document.getElementById('maxWidth');
    const $lock = document.getElementById('lockSettings');

    // 전역 노출: 다른 로직에서 사용
    window.cutterSettings = { kerf: 0, maxHeight: 0, maxWidth: 0, locked: false };

    function setInputsDisabled(disabled) {
        [$kerf, $maxHeight, $maxWidth].forEach(el => el.disabled = disabled);
    }

    function readFromInputs() {
        return {
            kerf: Number($kerf.value) || 0,
            maxHeight: Number($maxHeight.value) || 0,
            maxWidth: Number($maxWidth.value) || 0,
            locked: $lock.checked
        };
    }

    function saveSettings(source) {
        const next = readFromInputs();
        window.cutterSettings = next;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        if (source === 'apply') showToast && showToast('절단기 설정이 적용되었습니다.');
    }

    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            if (!saved) return;
            window.cutterSettings = { ...window.cutterSettings, ...saved };
            $kerf.value = saved.kerf ?? '';
            $maxHeight.value = saved.maxHeight ?? '';
            $maxWidth.value = saved.maxWidth ?? '';
            $lock.checked = !!saved.locked;
            setInputsDisabled($lock.checked);
        } catch (e) {
            console.warn('설정 로드 실패', e);
        }
    }

    // 이벤트
    document.getElementById('applySettings')?.addEventListener('click', () => saveSettings('apply'));
    document.getElementById('resetSettings')?.addEventListener('click', () => {
        [$kerf, $maxHeight, $maxWidth].forEach(el => el.value = '');
        $lock.checked = false;
        setInputsDisabled(false);
        saveSettings('apply');
    });
    [$kerf, $maxHeight, $maxWidth].forEach(el => el?.addEventListener('change', () => saveSettings('auto')));
    $lock?.addEventListener('change', (e) => {
        setInputsDisabled(e.target.checked);
        saveSettings('auto');
    });

    // 초기화
    loadSettings();

    // 폼 제출시 예시 사용 (main.js에 실제 계산 로직이 있다면 거기서 window.cutterSettings 참조)
    document.getElementById('inputForm')?.addEventListener('submit', function (e) {
        // 이 페이지에서는 버튼이 form 밖에 있으므로 기본 submit은 발생 안 할 수 있음.
        // 필요시 main.js에서 처리.
    });

})();

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('modalAddConfirm')?.addEventListener('click', () => {
        const modalEl = document.getElementById('addItemModal');


        const productEl = modalEl?.querySelector('#modalProduct');
        const specEl = modalEl?.querySelector('#modalSpec');
        const rawLenEl = modalEl?.querySelector('#modalRawLen');
        const orderEl = modalEl?.querySelector('#modalOrderLen');
        const qtyEl = modalEl?.querySelector('#modalQty');

        // 필수 요소 누락 방어
        if (!productEl || !specEl || !rawLenEl || !orderEl || !qtyEl) {
            showToast('모달 필드 id를 확인해주세요.', 'danger', 1500);
            return;
        }

        // 클릭 시점에만 표시 초기화
        [productEl, specEl, rawLenEl, orderEl, qtyEl]
            .forEach(el => el.classList.remove('is-invalid', 'is-valid'));

        const errs = [];

        // helper: disabled면 검사 스킵
        const need = el => el && !el.disabled;

        // 제품
        if (need(productEl)) {
            const v = (productEl.value || '').trim();
            if (!v || v === '선택') errs.push([productEl, '제품을 선택해주세요.']);
        }

        // 규격
        if (need(specEl)) {
            const v = (specEl.value || '').trim();
            if (!v || v === '선택') errs.push([specEl, '규격을 선택해주세요.']);
        }

        // 원자재길이
        if (need(rawLenEl)) {
            const v = Number(rawLenEl.value);
            if (!Number.isFinite(v) || v <= 0) errs.push([rawLenEl, '원자재길이를 선택하세요.']);
        }

        // 발주길이
        if (need(orderEl)) {
            const v = Number(orderEl.value);
            if (!Number.isFinite(v) || v <= 0) errs.push([orderEl, '발주길이는 0보다 커야 합니다.']);
        }

        // 수량
        if (need(qtyEl)) {
            const v = Number.parseInt(qtyEl.value, 10);
            if (!Number.isInteger(v) || v <= 0) errs.push([qtyEl, '수량은 1 이상의 정수여야 합니다.']);
        }

        if (errs.length) {
            const [el, msg] = errs[0];
            el.classList.add('is-invalid');
            el.focus();
            showToast(msg, 'danger', 1500);
            return;
        }

        const data = {
            product: (productEl.value || '').trim(),
            spec: (specEl.disabled ? '' : (specEl.value || '').trim()),
            rawLen: (rawLenEl.disabled ? null : Number(rawLenEl.value)),
            orderLen: Number(orderEl.value),
            qty: Number.parseInt(qtyEl.value, 10),
        };
        addRowFromModal(data);

        // 닫기
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.hide();
    });


    const modalEl = document.getElementById('addItemModal');
    const productSel = document.getElementById('modalProduct');
    const specSel = document.getElementById('modalSpec');
    const rawLenSel = document.getElementById('modalRawLen');
    const orderLenInp = document.getElementById('modalOrderLen');
    const qtyInp = document.getElementById('modalQty');

    const dependentFields = [specSel, rawLenSel, orderLenInp, qtyInp];

    function setEnabled(enabled) {
        dependentFields.forEach(el => el.disabled = !enabled);
    }

    function populateOptions(select, arr, placeholder) {
        select.innerHTML =
            `<option value="" disabled selected>${placeholder}</option>` +
            (arr || []).map(v => `<option value="${v}">${v}</option>`).join('');
    }

    function resetDependent() {
        populateOptions(specSel, [], '선택');
        populateOptions(rawLenSel, [], '선택');
        orderLenInp.value = '';
        qtyInp.value = 1;
        setEnabled(false);
    }

    // ✅ steelInfo → 제품 셀렉트 주입
    function populateProducts() {
        if (!steelInfo) {
            console.error('steelInfo가 없습니다. steelSpecs.js 로드/순서를 확인하세요.');
            return;
        }
        const products = Object.keys(steelInfo); // 예: ["H형강"]
        productSel.innerHTML =
            `<option value="" disabled selected>선택</option>` +
            products.map(p => `<option value="${p}">${p}</option>`).join('');
        productSel.disabled = false;
        productSel.value = ''; // placeholder 유지
    }

    // 모달 열릴 때 초기화
    modalEl.addEventListener('show.bs.modal', () => {
        // 제품 목록이 비어 있으면 한 번만 채움
        if (productSel.options.length <= 1) {
            populateProducts();
        } else {
            // 이미 채워져 있으면 선택만 초기화
            productSel.value = '';
            productSel.disabled = false;
        }
        resetDependent();
    });

    // 제품 선택 시: 규격/길이 옵션 채우고 나머지 활성화
    productSel.addEventListener('change', () => {
        const key = productSel.value;
        const info = steelInfo?.[key];
        if (!info) { resetDependent(); return; }

        populateOptions(specSel, info.specs || [], '선택');
        populateOptions(rawLenSel, info.lengths || [], '선택');
        setEnabled(true);
    });

    // 모달 닫힐 때 깔끔히 리셋
    modalEl.addEventListener('hidden.bs.modal', resetDependent);
});