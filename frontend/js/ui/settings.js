export function focusSettingInput(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const lock = document.getElementById('lockSettings');
  if (lock?.checked) {
    lock.checked = false;
    document.getElementById('kerf')?.removeAttribute('disabled');
    document.getElementById('maxHeight')?.removeAttribute('disabled');
    document.getElementById('maxWidth')?.removeAttribute('disabled');
  }

  el.classList.add('is-invalid');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => el.focus({ preventScroll: true }), 50);
  setTimeout(() => el.classList.remove('is-invalid'), 1500);
}

