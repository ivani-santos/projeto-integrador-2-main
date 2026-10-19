(() => {
  const root = document.documentElement;
  const storageKeys = {
    contrast: 'fotecta_alto_contraste',
    scale: 'fotecta_text_scale',
  };
  const minScale = 0.8;
  const maxScale = 1.4;
  const step = 0.1;

  function readPreference(key, fallback) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch (error) {
      console.warn('Não foi possível ler as preferências de acessibilidade.', error);
      return fallback;
    }
  }

  function savePreference(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Não foi possível salvar as preferências de acessibilidade.', error);
    }
  }

  const storedScale = Number.parseFloat(readPreference(storageKeys.scale, '1'));
  let scale = Number.isFinite(storedScale)
    ? Math.min(maxScale, Math.max(minScale, storedScale))
    : 1;

  const skipLink = document.createElement('a');
  skipLink.className = 'skip-link';
  skipLink.href = '#main-content';
  skipLink.textContent = 'Pular para o conteúdo principal';

  const main = document.querySelector('main');
  if (main) {
    if (!main.id) main.id = 'main-content';
    if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
  }

  const tools = document.createElement('div');
  tools.className = 'accessibility-tools';
  tools.setAttribute('role', 'group');
  tools.setAttribute('aria-label', 'Ferramentas de acessibilidade');

  const announcer = document.createElement('span');
  announcer.className = 'sr-only';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');

  function announce(message) {
    announcer.textContent = '';
    window.requestAnimationFrame(() => {
      announcer.textContent = message;
    });
  }

  function applyScale(nextScale, message) {
    scale = Math.min(maxScale, Math.max(minScale, nextScale));
    root.style.fontSize = `${Math.round(scale * 100)}%`;
    savePreference(storageKeys.scale, String(scale));
    if (message) announce(message);
  }

  function addButton(label, accessibleName, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-label', accessibleName);
    button.addEventListener('click', onClick);
    tools.append(button);
    return button;
  }

  addButton('A−', 'Diminuir o tamanho do texto', () => {
    const nextScale = Math.max(minScale, Math.round((scale - step) * 10) / 10);
    applyScale(nextScale, nextScale === minScale
      ? 'Tamanho mínimo do texto atingido.'
      : 'Tamanho do texto diminuído.');
  });

  addButton('A', 'Restaurar o tamanho original do texto', () => {
    applyScale(1, 'Tamanho do texto restaurado.');
  });

  addButton('A+', 'Aumentar o tamanho do texto', () => {
    const nextScale = Math.min(maxScale, Math.round((scale + step) * 10) / 10);
    applyScale(nextScale, nextScale === maxScale
      ? 'Tamanho máximo do texto atingido.'
      : 'Tamanho do texto aumentado.');
  });

  const contrastButton = addButton('Alto contraste', 'Ativar ou desativar o alto contraste', () => {
    const enabled = !document.body.classList.contains('alto-contraste');
    document.body.classList.toggle('alto-contraste', enabled);
    contrastButton.setAttribute('aria-pressed', String(enabled));
    savePreference(storageKeys.contrast, String(enabled));
    announce(enabled ? 'Alto contraste ativado.' : 'Alto contraste desativado.');
  });

  const contrastEnabled = readPreference(storageKeys.contrast, 'false') === 'true';
  document.body.classList.toggle('alto-contraste', contrastEnabled);
  contrastButton.setAttribute('aria-pressed', String(contrastEnabled));
  applyScale(scale);

  document.body.prepend(skipLink, tools, announcer);
})();
