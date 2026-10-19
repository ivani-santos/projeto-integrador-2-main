(() => {
  const root = document.documentElement;
  const body = document.body;
  const announcer = document.querySelector('#sr-announcer');
  const contrastButton = document.querySelector('#btn-alto-contraste');
  const increaseButton = document.querySelector('#btn-aumentar-texto');
  const decreaseButton = document.querySelector('#btn-diminuir-texto');
  const resetButton = document.querySelector('#btn-restaurar-texto');
  const storageKeys = { contrast: 'fotecta_alto_contraste', scale: 'fotecta_text_scale' };
  const minScale = 0.8;
  const maxScale = 1.4;
  const step = 0.1;

  function announce(message) {
    if (!announcer) return;
    announcer.textContent = '';
    window.requestAnimationFrame(() => { announcer.textContent = message; });
  }

  function readScale() {
    const value = Number.parseFloat(localStorage.getItem(storageKeys.scale) || '1');
    return Number.isFinite(value) ? Math.min(maxScale, Math.max(minScale, value)) : 1;
  }

  function applyScale(scale, message = '') {
    const normalized = Math.min(maxScale, Math.max(minScale, scale));
    root.style.fontSize = `${Math.round(normalized * 100)}%`;
    localStorage.setItem(storageKeys.scale, String(normalized));
    increaseButton?.setAttribute('aria-pressed', String(normalized > 1));
    decreaseButton?.setAttribute('aria-pressed', String(normalized < 1));
    resetButton?.setAttribute('aria-pressed', String(normalized === 1));
    if (message) announce(message);
  }

  function applyContrast(enabled, message = '') {
    body.classList.toggle('alto-contraste', enabled);
    contrastButton?.setAttribute('aria-pressed', String(enabled));
    localStorage.setItem(storageKeys.contrast, String(enabled));
    if (message) announce(message);
  }

  contrastButton?.addEventListener('click', () => {
    const enabled = !body.classList.contains('alto-contraste');
    applyContrast(enabled, enabled ? 'Alto contraste ativado.' : 'Alto contraste desativado.');
  });

  increaseButton?.addEventListener('click', () => {
    const next = Math.min(maxScale, readScale() + step);
    applyScale(next, next === maxScale ? 'Tamanho máximo do texto atingido.' : 'Tamanho do texto aumentado.');
  });

  decreaseButton?.addEventListener('click', () => {
    const next = Math.max(minScale, readScale() - step);
    applyScale(next, next === minScale ? 'Tamanho mínimo do texto atingido.' : 'Tamanho do texto diminuído.');
  });

  resetButton?.addEventListener('click', () => applyScale(1, 'Tamanho do texto restaurado.'));

  applyScale(readScale());
  applyContrast(localStorage.getItem(storageKeys.contrast) === 'true');
})();

