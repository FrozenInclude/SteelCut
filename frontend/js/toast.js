function showToast(message, type = 'primary', duration = 1000) {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `alert alert-${type} alert-dismissible fade show`;
    toast.setAttribute('role', 'alert');
    toast.style.minWidth = '200px';
    toast.style.marginBottom = '0.5rem';

    toast.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        // 부트스트랩 dismiss 트리거
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => container.removeChild(toast), 300); // transition 시간 이후 제거
    }, duration);
}