function addRow() {
    const tbody = document.getElementById('formRows');
    const firstRow = tbody.querySelector('.input-row');
    const newRow = firstRow.cloneNode(true);
    newRow.querySelectorAll('input, select').forEach(el => el.value = '선택');
    tbody.appendChild(newRow);
}

function removeRow(button) {
    const row = button.closest('tr');
    const tbody = document.getElementById('formRows');
    if (tbody.querySelectorAll('tr').length > 1) {
        row.remove();
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