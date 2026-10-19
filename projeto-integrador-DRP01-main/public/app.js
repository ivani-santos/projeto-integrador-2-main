const list = document.querySelector('#lista-profissionais');
const searchForm = document.querySelector('#filtro-form');
const searchStatus = document.querySelector('#busca-status');
const signupForm = document.querySelector('#cadastro-form');
const signupStatus = document.querySelector('#cadastro-status');
const signupErrors = document.querySelector('#cadastro-erros');
const emailInput = document.querySelector('#cadastro-email');
const passwordInput = document.querySelector('#cadastro-senha');
const emailFeedback = document.querySelector('#email-feedback');
const passwordFeedback = document.querySelector('#senha-feedback');
const loginForm = document.querySelector('#login-form');
const loginErrors = document.querySelector('#login-erros');
const loginStatus = document.querySelector('#login-status');
const recoveryForm = document.querySelector('#recuperacao-form');
const recoveryStatus = document.querySelector('#recuperacao-status');
const loginEmailInput = document.querySelector('#login-email');
const loginPasswordInput = document.querySelector('#login-senha');
const recoveryEmailInput = document.querySelector('#recuperacao-email');
const authNav = document.querySelector('#nav-auth');
const dashboard = document.querySelector('#dashboard-logado');
const dashboardName = document.querySelector('#dashboard-nome');
const clientProjectsBlock = document.querySelector('#cliente-projetos-bloco');
const clientProjectsList = document.querySelector('#cliente-projetos-lista');
const photographerDashboard = document.querySelector('#dashboard-fotografo');
const photographerProfileForm = document.querySelector('#perfil-fotografo-form');
const portfolioForm = document.querySelector('#portfolio-form');
const portfolioList = document.querySelector('#portfolio-lista');
const projectsList = document.querySelector('#projetos-lista');
const photographerReviewsList = document.querySelector('#avaliacoes-recebidas-lista');
const quoteSection = document.querySelector('#orcamento');
const quoteForm = document.querySelector('#orcamento-form');
const quoteStatus = document.querySelector('#orcamento-status');
const quoteProfessional = document.querySelector('#orcamento-profissional');
const quoteProfessionalName = document.querySelector('#orcamento-profissional-nome');
const loginSection = document.querySelector('#login');
const signupSection = document.querySelector('#cadastro');
const clientProfileForm = document.querySelector('#perfil-cliente-form');
const clientProfileStatus = document.querySelector('#perfil-cliente-status');

// Map Elements & Variables
const mapToggleBtn = document.querySelector('#btn-toggle-mapa');
const mapContainer = document.querySelector('#mapa-container');
const gpsBtn = document.querySelector('#btn-gps');
let leafletMap = null;
let mapMarkers = [];
let currentProfessionals = [];
let currentUserData = null;
let chatPollTimer = null;
let userCoordinates = null;

// Chat Elements
const chatSection = document.querySelector('#chat-secao');
const chatTitle = document.querySelector('#chat-titulo-projeto');
const chatParticipants = document.querySelector('#chat-participantes');
const chatMessagesContainer = document.querySelector('#chat-mensagens');
const chatForm = document.querySelector('#chat-form');
const chatProjectIdInput = document.querySelector('#chat-projeto-id');
const chatTextInput = document.querySelector('#chat-texto');
const chatCloseBtn = document.querySelector('#btn-fechar-chat');
const chatDenounceBtn = document.querySelector('#btn-denunciar-chat');

function text(value, fallback = '') {
  return value == null || value === '' ? fallback : String(value);
}

function escapeHtml(value) {
  return text(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function explainFetchError(error) {
  if (error instanceof TypeError && window.location.protocol === 'file:') {
    return 'Abra a aplicação pelo endereço http://127.0.0.1:3000 após iniciar o servidor Express.';
  }
  return error.message || 'Não foi possível conectar à API.';
}

async function withSubmitLock(buttonOrForm, asyncFn) {
  if (!buttonOrForm) return asyncFn();
  const button = buttonOrForm.tagName === 'BUTTON' ? buttonOrForm : buttonOrForm.querySelector('button[type="submit"]');
  if (button && button.disabled) return;
  const originalText = button ? button.innerHTML : '';
  if (button) {
    button.disabled = true;
    button.style.opacity = '0.65';
    button.style.cursor = 'wait';
  }
  try {
    return await asyncFn();
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalText;
      button.style.opacity = '1';
      button.style.cursor = '';
    }
  }
}

async function apiFetch(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : { message: await response.text() };
    if (response.status === 401) {
      if (currentUserData) {
        currentUserData = null;
        renderSession(null);
        alert('Sua sessão expirou ou não é válida. Faça login novamente.');
        window.location.hash = 'login';
      }
      throw new Error(data.message || 'Sessão expirada. Faça login novamente.');
    }
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || `A API respondeu com HTTP ${response.status}.`);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('A API demorou demais para responder. Tente novamente.');
    throw new Error(explainFetchError(error));
  } finally {
    window.clearTimeout(timeout);
  }
}

function closeChat() {
  if (chatPollTimer) {
    clearInterval(chatPollTimer);
    chatPollTimer = null;
  }
  if (chatSection) chatSection.hidden = true;
  if (chatMessagesContainer) chatMessagesContainer.innerHTML = '';
  if (chatProjectIdInput) chatProjectIdInput.value = '';
  if (chatTextInput) chatTextInput.value = '';
  if (chatTitle) chatTitle.textContent = 'Projeto';
  if (chatParticipants) chatParticipants.textContent = '';
}

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderAvatarInCircle(container, user) {
  if (!container) return;
  if (user && user.foto) {
    container.innerHTML = `<img src="${escapeHtml(user.foto)}" alt="Foto de perfil de ${escapeHtml(user.nome || '')}">`;
  } else {
    const initials = getInitials(user ? user.nome : '');
    container.innerHTML = `<span>${escapeHtml(initials)}</span>`;
  }
}

function openAvatarModal() {
  if (!currentUserData) return;
  const user = currentUserData;
  const modal = document.querySelector('#modal-foto-perfil');
  const preview = document.querySelector('#modal-avatar-preview');
  const nameEl = document.querySelector('#modal-foto-usuario');
  const roleEl = document.querySelector('#modal-foto-tipo');
  const removeBtn = document.querySelector('#modal-btn-remover');
  const statusEl = document.querySelector('#modal-foto-status');

  if (!modal) return;
  if (nameEl) nameEl.textContent = user.nome;
  if (roleEl) roleEl.textContent = user.tipo === 'fotografo' ? 'Fotógrafo(a)' : user.tipo === 'admin' ? 'Administrador' : 'Cliente';
  if (statusEl) statusEl.textContent = '';

  renderAvatarInCircle(preview, user);

  if (removeBtn) {
    if (user.foto) {
      removeBtn.disabled = false;
      removeBtn.style.opacity = '1';
      removeBtn.style.cursor = 'pointer';
    } else {
      removeBtn.disabled = true;
      removeBtn.style.opacity = '0.4';
      removeBtn.style.cursor = 'not-allowed';
    }
  }

  modal.hidden = false;
  document.querySelector('#modal-btn-escolher')?.focus();
}

function closeAvatarModal() {
  const modal = document.querySelector('#modal-foto-perfil');
  if (modal) modal.hidden = true;
  const statusEl = document.querySelector('#modal-foto-status');
  if (statusEl) statusEl.textContent = '';
  const fileInput = document.querySelector('#modal-foto-input');
  if (fileInput) fileInput.value = '';
}

async function handleAvatarUpload(file) {
  if (!file) return;
  const statusEl = document.querySelector('#modal-foto-status');
  const preview = document.querySelector('#modal-avatar-preview');

  // Preview instantly
  const reader = new FileReader();
  reader.onload = (e) => {
    if (preview) {
      preview.innerHTML = `<img src="${escapeHtml(e.target.result)}" alt="Prévia da nova foto">`;
    }
  };
  reader.readAsDataURL(file);

  if (statusEl) statusEl.textContent = 'Enviando e ajustando foto...';

  const formData = new FormData();
  formData.append('fotoPerfil', file);

  try {
    const data = await apiFetch('/api/me/foto', {
      method: 'POST',
      body: formData,
    });
    if (statusEl) statusEl.textContent = 'Foto de perfil atualizada com sucesso!';
    currentUserData = data.user || { ...currentUserData, foto: data.foto };
    renderSession(currentUserData);
    setTimeout(closeAvatarModal, 1100);
  } catch (error) {
    if (statusEl) statusEl.textContent = `Erro ao salvar foto: ${error.message}`;
    renderAvatarInCircle(preview, currentUserData);
  }
}

async function handleAvatarRemove() {
  if (!currentUserData || !currentUserData.foto) {
    alert('Você já está utilizando o avatar padrão com suas iniciais.');
    return;
  }
  const statusEl = document.querySelector('#modal-foto-status');
  const preview = document.querySelector('#modal-avatar-preview');
  const removeBtn = document.querySelector('#modal-btn-remover');

  if (statusEl) statusEl.textContent = 'Removendo foto de perfil...';
  try {
    const data = await apiFetch('/api/me/foto', { method: 'DELETE' });
    if (statusEl) statusEl.textContent = 'Foto removida! O círculo agora exibe suas iniciais.';
    currentUserData = data.user || { ...currentUserData, foto: '' };
    renderSession(currentUserData);
    renderAvatarInCircle(preview, currentUserData);
    if (removeBtn) {
      removeBtn.disabled = true;
      removeBtn.style.opacity = '0.4';
      removeBtn.style.cursor = 'not-allowed';
    }
    setTimeout(closeAvatarModal, 1100);
  } catch (error) {
    if (statusEl) statusEl.textContent = `Erro ao remover: ${error.message}`;
  }
}

function renderSession(user) {
  currentUserData = user;
  const loggedIn = Boolean(user);

  // Hide login & registration forms completely when logged in
  if (loginSection) loginSection.hidden = loggedIn;
  if (signupSection) signupSection.hidden = loggedIn;

  if (loggedIn) {
    if (user.tipo === 'fotografo') {
      photographerDashboard.hidden = false;
      dashboard.hidden = true;
    } else {
      photographerDashboard.hidden = true;
      dashboard.hidden = false;
    }
  } else {
    photographerDashboard.hidden = true;
    dashboard.hidden = true;
  }

  if (clientProjectsBlock) {
    clientProjectsBlock.hidden = !loggedIn || user.tipo === 'fotografo';
  }

  if (!loggedIn) {
    closeChat();
    closeAvatarModal();
    if (quoteSection) quoteSection.hidden = true;
    authNav.innerHTML = '<span class="visitor-menu"><a href="#login">Entrar</a><a href="#cadastro">Cadastrar</a></span>';
    return;
  }

  const firstName = user.nome.trim().split(/\s+/)[0];
  const initials = getInitials(user.nome);
  const avatarInner = user.foto
    ? `<img class="nav-avatar-img" src="${escapeHtml(user.foto)}" alt="Foto de perfil de ${escapeHtml(user.nome)}">`
    : `<span class="nav-avatar-initials">${escapeHtml(initials)}</span>`;

  const panelLink = user.tipo === 'fotografo'
    ? '<a href="#dashboard-fotografo" class="nav-panel-link">Painel & portfólio</a>'
    : user.tipo === 'admin'
    ? '<a href="/admin" class="nav-panel-link">Painel Admin</a>'
    : '<a href="#dashboard-logado" class="nav-panel-link">Meus dados</a>';

  authNav.innerHTML = `
    <span class="user-menu">
      ${panelLink}
      <button id="btn-avatar-circle" class="nav-avatar-btn" type="button" title="Ajustar ou remover foto de perfil" aria-label="Ajustar ou remover foto de perfil de ${escapeHtml(user.nome)}" aria-haspopup="dialog">
        ${avatarInner}
        <span class="nav-avatar-badge" aria-hidden="true">✎</span>
      </button>
      <span class="user-name">Olá, ${escapeHtml(firstName)}</span>
      <button id="btn-logout" class="nav-button" type="button">Sair</button>
    </span>
  `;
  authNav.querySelector('#btn-logout').addEventListener('click', logout);
  authNav.querySelector('#btn-avatar-circle').addEventListener('click', openAvatarModal);
  dashboardName.textContent = firstName;

  // Resume pending quote if user logged in after clicking request quote
  const pendingQuote = sessionStorage.getItem('fotecta_pending_quote');
  if (pendingQuote) {
    try {
      const parsed = JSON.parse(pendingQuote);
      if (parsed && parsed.id && user.id !== Number(parsed.id)) {
        sessionStorage.removeItem('fotecta_pending_quote');
        quoteProfessional.value = parsed.id;
        quoteProfessionalName.textContent = `Profissional selecionado: ${parsed.name || ''}`;
        quoteSection.hidden = false;
        setTimeout(() => {
          quoteSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          document.querySelector('#orcamento-titulo')?.focus();
        }, 300);
      }
    } catch (_) {
      sessionStorage.removeItem('fotecta_pending_quote');
    }
  }

  // Update client / user summary card in dashboard
  const dashAvatar = document.querySelector('#dash-avatar-circle');
  const dashName = document.querySelector('#dash-user-nome');
  const dashEmail = document.querySelector('#dash-user-email');
  const dashTipo = document.querySelector('#dash-user-tipo');
  if (dashAvatar) renderAvatarInCircle(dashAvatar, user);
  if (dashName) dashName.textContent = user.nome;
  if (dashEmail) dashEmail.textContent = user.email;
  if (dashTipo) dashTipo.textContent = user.tipo === 'fotografo' ? 'Fotógrafo(a)' : user.tipo === 'admin' ? 'Administrador' : 'Cliente';

  const dashBtnRemover = document.querySelector('#dash-btn-remover-foto');
  if (dashBtnRemover) {
    dashBtnRemover.style.display = user.foto ? 'inline-flex' : 'none';
  }

  if (user.tipo === 'fotografo') {
    loadPhotographerDashboard();
  } else {
    loadClientDashboard();
  }
}

async function logout() {
  const logoutButton = authNav.querySelector('#btn-logout');
  if (logoutButton) logoutButton.disabled = true;
  try {
    const response = await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
  } finally {
    localStorage.removeItem('fotecta_user');
    localStorage.removeItem('fotecta_token');
    closeChat();
    if (quoteSection) quoteSection.hidden = true;
    if (loginSection) loginSection.hidden = false;
    if (signupSection) signupSection.hidden = false;
    renderSession(null);
    window.location.replace('/#inicio');
  }
}

function renderPortfolio(items) {
  if (!items.length) {
    portfolioList.innerHTML = '<p class="status">Seu portfólio ainda está vazio.</p>';
    return;
  }
  portfolioList.innerHTML = items.map((item) => `<article class="portfolio-manage-card">
    <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.legenda || `Foto da coleção ${item.nome || 'sem nome'}`)}" loading="lazy">
    <strong>${escapeHtml(item.nome || 'Coleção sem nome')}</strong>
    <label>Categoria<select data-edit-category="${escapeHtml(item.id)}"><option ${item.categoria === 'Casamentos' ? 'selected' : ''}>Casamentos</option><option ${item.categoria === 'Ensaios' ? 'selected' : ''}>Ensaios</option><option ${item.categoria === 'Eventos' ? 'selected' : ''}>Eventos</option><option ${item.categoria === 'Publicidade' ? 'selected' : ''}>Publicidade</option><option ${!['Casamentos', 'Ensaios', 'Eventos', 'Publicidade'].includes(item.categoria) ? 'selected' : ''}>Outros</option></select></label>
    <label>Legenda<input data-edit-caption="${escapeHtml(item.id)}" value="${escapeHtml(item.legenda || '')}" required></label>
    <button class="button button-secondary" type="button" data-delete-portfolio="${escapeHtml(item.id)}">Excluir fotografia</button>
    <button class="button button-primary" type="button" data-save-portfolio="${escapeHtml(item.id)}">Salvar alterações</button>
  </article>`).join('');
}

function renderProjects(items) {
  if (!items.length) {
    projectsList.innerHTML = '<p class="status">Nenhuma solicitação atribuída no momento.</p>';
    return;
  }
  projectsList.innerHTML = items.map((item) => `<article class="project-row">
    <div>
      <strong>${escapeHtml(item.titulo)}</strong>
      <p>${escapeHtml(item.descricao)} · ${escapeHtml(item.cidade)}/${escapeHtml(item.estado)}</p>
      <small>Cliente: ${escapeHtml(item.cliente)} ${item.dataEvento ? `· Data: ${new Date(item.dataEvento).toLocaleDateString('pt-BR')}` : ''} ${item.valor ? `· Proposta: <strong>${escapeHtml(item.valor)}</strong>` : ''} ${item.metodo_pagamento ? `· Pagamento: <strong>${escapeHtml(item.metodo_pagamento)}</strong>` : ''}</small>
      <div style="margin-top: 0.5rem;">
        <button class="button button-secondary" type="button" data-open-chat="${escapeHtml(item.id_projeto)}" data-chat-title="${escapeHtml(item.titulo)}" data-chat-user="${escapeHtml(item.cliente)}">💬 Abrir conversa / Chat</button>
      </div>
    </div>
    <label>Status <select data-project-status="${escapeHtml(item.id_projeto)}"><option value="aberto" ${item.status === 'aberto' ? 'selected' : ''}>Pendente</option><option value="em_conversa" ${item.status === 'em_conversa' ? 'selected' : ''}>Em conversa</option><option value="agendado" ${item.status === 'agendado' ? 'selected' : ''}>Agendado</option><option value="concluido" ${item.status === 'concluido' ? 'selected' : ''}>Concluído</option><option value="cancelado" ${item.status === 'cancelado' ? 'selected' : ''}>Cancelado</option></select></label>
  </article>`).join('');
}

function renderClientProjects(items) {
  if (!clientProjectsList) return;
  if (!items.length) {
    clientProjectsList.innerHTML = '<p class="status">Você ainda não enviou solicitações de orçamento.</p>';
    return;
  }
  clientProjectsList.innerHTML = items.map((item) => `<article class="project-row">
    <div>
      <strong>${escapeHtml(item.titulo)}</strong>
      <p>${escapeHtml(item.descricao)} · ${escapeHtml(item.cidade)}/${escapeHtml(item.estado)}</p>
      <small>Status: <strong>${escapeHtml(item.status)}</strong> ${item.valor ? `· Proposta: <strong>${escapeHtml(item.valor)}</strong>` : ''} ${item.metodo_pagamento ? `· Pagamento: <strong>${escapeHtml(item.metodo_pagamento)}</strong>` : ''}</small>
      <div style="margin-top: 0.5rem;">
        <button class="button button-secondary" type="button" data-open-chat="${escapeHtml(item.id_projeto)}" data-chat-title="${escapeHtml(item.titulo)}" data-chat-user="Fotógrafo">💬 Abrir conversa / Chat</button>
      </div>
    </div>
  </article>`).join('');
}

function renderPhotographerReviews(reviews) {
  if (!photographerReviewsList) return;
  if (!reviews.length) {
    photographerReviewsList.innerHTML = '<p class="status">Você ainda não recebeu avaliações.</p>';
    return;
  }
  photographerReviewsList.innerHTML = reviews.map((r) => `<article class="review-card">
    <div class="review-header">
      <strong>${escapeHtml(r.cliente_nome)}</strong>
      <span class="review-stars">${'★'.repeat(r.nota)}${'☆'.repeat(5 - r.nota)}</span>
      <small>${new Date(r.created_at).toLocaleDateString('pt-BR')}</small>
    </div>
    <p class="review-comment">${escapeHtml(r.comentario)}</p>
    ${r.resposta ? `<div class="review-reply"><strong>Sua resposta:</strong><p>${escapeHtml(r.resposta)}</p></div>` : `
      <form class="review-reply-form" data-review-id="${escapeHtml(r.id)}" style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
        <input type="text" placeholder="Responder a este feedback..." required style="flex: 1; border: 1px solid var(--border-color); padding: 0.4rem 0.8rem; border-radius: 4px;">
        <button class="button button-secondary" type="submit" style="padding: 0.4rem 0.8rem; min-height: 2.2rem; font-size: 0.82rem;">Responder</button>
      </form>
    `}
  </article>`).join('');
}

async function loadPhotographerDashboard() {
  const results = await Promise.allSettled([
    apiFetch('/api/me'),
    apiFetch('/api/fotografo/portfolio'),
    apiFetch('/api/projetos'),
  ]);
  const [profileResult, portfolioResult, projectsResult] = results;
  if (profileResult.status === 'fulfilled' && profileResult.value.user) {
    const profile = profileResult.value.user;
    const bioInput = document.querySelector('#fotografo-bio');
    const locInput = document.querySelector('#fotografo-localizacao');
    const precoInput = document.querySelector('#fotografo-preco');
    const instaInput = document.querySelector('#fotografo-instagram');
    const telInput = document.querySelector('#fotografo-telefone');
    const cpfInput = document.querySelector('#fotografo-cpf');

    if (bioInput) bioInput.value = profile.biografia || '';
    if (locInput) locInput.value = profile.localizacao || '';
    if (precoInput) precoInput.value = profile.preco || '';
    if (instaInput) instaInput.value = profile.instagram || '';
    if (telInput) telInput.value = profile.telefone || '';
    if (cpfInput) cpfInput.value = profile.cpf || '';

    // Populate accepted payment methods checkboxes
    const metodosChecks = document.querySelectorAll('#fotografo-metodos-pagamento input[type="checkbox"]');
    const userMetodos = Array.isArray(profile.metodos_pagamento) ? profile.metodos_pagamento : [];
    metodosChecks.forEach((cb) => {
      cb.checked = userMetodos.includes(cb.value);
    });

    const fotoPreview = document.querySelector('#fotografo-avatar-preview');
    if (fotoPreview) renderAvatarInCircle(fotoPreview, profile);
    const removeFotoBtn = document.querySelector('#fotografo-btn-remover-foto');
    if (removeFotoBtn) {
      removeFotoBtn.style.display = profile.foto ? 'inline-flex' : 'none';
    }

    // Load photographer's own reviews
    try {
      const details = await apiFetch(`/api/profissionais/${profile.id}`);
      renderPhotographerReviews(details.profissional?.avaliacoes || []);
    } catch (_) {}
  }
  if (portfolioResult.status === 'fulfilled') renderPortfolio(portfolioResult.value.portfolio || []);
  else portfolioList.innerHTML = `<p class="status">Erro ao carregar galeria: ${escapeHtml(portfolioResult.reason.message)}</p>`;
  if (projectsResult.status === 'fulfilled') renderProjects(projectsResult.value.projetos || []);
  else projectsList.innerHTML = `<p class="status">Erro ao carregar solicitações: ${escapeHtml(projectsResult.reason.message)}</p>`;
}

async function loadClientDashboard() {
  if (currentUserData) {
    const nomeInput = document.querySelector('#cliente-nome');
    const cidadeInput = document.querySelector('#cliente-cidade');
    const interessesInput = document.querySelector('#cliente-interesses');
    const bioInput = document.querySelector('#cliente-bio');
    const telInput = document.querySelector('#cliente-telefone');
    const cpfInput = document.querySelector('#cliente-cpf');

    if (nomeInput) nomeInput.value = currentUserData.nome || '';
    if (cidadeInput) cidadeInput.value = currentUserData.localizacao || '';
    if (interessesInput) interessesInput.value = currentUserData.interesses || '';
    if (bioInput) bioInput.value = currentUserData.bio || '';
    if (telInput) telInput.value = currentUserData.telefone || '';
    if (cpfInput) cpfInput.value = currentUserData.cpf || '';
  }
  try {
    const data = await apiFetch('/api/projetos');
    renderClientProjects(data.projetos || []);
  } catch (_) {}
}

async function loadSession() {
  try {
    const response = await fetch('/api/me');
    const data = await response.json();
    renderSession(data.ok ? data.user : null);
  } catch (_error) {
    renderSession(null);
  } finally {
    handleRoute();
  }
}

function clearSignupErrors() {
  signupErrors.hidden = true;
  signupErrors.replaceChildren();
  [emailInput, passwordInput].forEach((input) => {
    input.removeAttribute('aria-invalid');
  });
}

function updateFieldState(input, feedback, isValid, validMessage, invalidMessage) {
  input.classList.toggle('is-valid', isValid);
  input.classList.toggle('is-invalid', !isValid);
  feedback.className = `field-feedback ${isValid ? 'text-success' : 'text-error'}`;
  feedback.textContent = isValid ? validMessage : invalidMessage;
}

function updateEmailState() {
  const email = emailInput.value.trim();
  if (!email) {
    emailInput.classList.remove('is-valid', 'is-invalid');
    emailFeedback.className = 'field-feedback';
    emailFeedback.textContent = '';
    return false;
  }
  const valid = validEmail(email);
  updateFieldState(emailInput, emailFeedback, valid, 'E-mail válido.', 'Informe um e-mail válido.');
  return valid;
}

function updatePasswordState() {
  const password = passwordInput.value;
  if (!password) {
    passwordInput.classList.remove('is-valid', 'is-invalid');
    passwordFeedback.className = 'field-feedback';
    passwordFeedback.textContent = 'Mínimo de 8 caracteres.';
    return false;
  }
  const valid = password.length >= 8;
  updateFieldState(passwordInput, passwordFeedback, valid, 'Senha com tamanho adequado.', 'A senha deve conter no mínimo 8 caracteres.');
  return valid;
}

function showSignupErrors(errors) {
  signupErrors.innerHTML = `<strong>Atenção aos seguintes erros:</strong><ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>`;
  signupErrors.hidden = false;
  signupErrors.focus();
}

function showFormError(container, message) {
  container.innerHTML = `<strong>${escapeHtml(message)}</strong>`;
  container.hidden = false;
  container.focus();
}

function validateSignup() {
  const errors = [];
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !updateEmailState()) {
    errors.push('Por favor, insira um endereço de e-mail válido.');
    emailInput.setAttribute('aria-invalid', 'true');
  }
  if (!password || !updatePasswordState()) {
    errors.push('A senha deve conter no mínimo 8 caracteres.');
    passwordInput.setAttribute('aria-invalid', 'true');
  }
  return errors;
}

function renderProfile(profile) {
  const photos = (profile.portfolio || []).map((photo, index) => `
    <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.alt || `Foto ${index + 1} do portfólio de ${profile.nome}`)}" loading="lazy">
  `).join('');
  const profilePhoto = profile.foto
    ? `<img class="profile-photo" src="${escapeHtml(profile.foto)}" alt="Foto de perfil de ${escapeHtml(profile.nome)}">`
    : '<div class="profile-photo" role="img" aria-label="Foto de perfil não informada"></div>';

  const reviews = profile.avaliacoes || [];
  const reviewsHtml = reviews.length ? reviews.map((r) => `
    <article class="review-card">
      <div class="review-header">
        <strong>${escapeHtml(r.cliente_nome)}</strong>
        <span class="review-stars">${'★'.repeat(r.nota)}${'☆'.repeat(5 - r.nota)}</span>
        <small>${new Date(r.created_at).toLocaleDateString('pt-BR')}</small>
      </div>
      <p class="review-comment">${escapeHtml(r.comentario)}</p>
      ${r.resposta ? `<div class="review-reply"><strong>Resposta do profissional:</strong><p>${escapeHtml(r.resposta)}</p></div>` : ''}
    </article>
  `).join('') : '<p class="status">Este profissional ainda não recebeu avaliações.</p>';

  const ratingBadge = profile.media_nota
    ? `<div class="card-rating" style="margin: 0.5rem 0; font-size: 1rem;">★ ${profile.media_nota} <small style="color: var(--text-muted); font-size: 0.9rem;">(${profile.total_avaliacoes || 0} avaliações de clientes verificados)</small></div>`
    : '';

  const canReview = currentUserData && currentUserData.id !== profile.id;
  const reviewFormHtml = canReview ? `
    <form id="form-enviar-avaliacao" class="review-form" data-prof-id="${escapeHtml(profile.id)}">
      <h4>Avaliar este profissional</h4>
      <div class="field">
        <label for="review-nota">Sua nota</label>
        <select id="review-nota" name="nota" required>
          <option value="5">★★★★★ - Excelente (5 estrelas)</option>
          <option value="4">★★★★☆ - Muito bom (4 estrelas)</option>
          <option value="3">★★★☆☆ - Bom (3 estrelas)</option>
          <option value="2">★★☆☆☆ - Regular (2 estrelas)</option>
          <option value="1">★☆☆☆☆ - Ruim (1 estrela)</option>
        </select>
      </div>
      <div class="field">
        <label for="review-comentario">Seu depoimento / recomendação</label>
        <textarea id="review-comentario" name="comentario" rows="3" required placeholder="Conte como foi sua experiência com este fotógrafo."></textarea>
      </div>
      <button class="button button-primary" type="submit">Publicar avaliação</button>
      <p id="review-status" class="status"></p>
    </form>
  ` : (!currentUserData ? `<p style="margin-top: 1.5rem; color: var(--text-muted); font-size: 0.9rem;"><a href="#login" style="text-decoration: underline;">Entre na sua conta</a> para avaliar este profissional.</p>` : '');

  const paymentMethodsHtml = Array.isArray(profile.metodos_pagamento) && profile.metodos_pagamento.length
    ? `<div style="margin-top: 0.85rem;">
        <strong style="font-size: 0.9rem;">💳 Formas de pagamento aceitas:</strong>
        <div class="tags" style="margin-top: 0.35rem;">
          ${profile.metodos_pagamento.map((p) => `<span class="tag tag-payment">✓ ${escapeHtml(p)}</span>`).join('')}
        </div>
      </div>`
    : '';

  const phone = (profile.telefone || '').trim();
  const whatsAppButton = profile.whatsapp_clicks != null || phone
    ? `<button class="button button-secondary" type="button" data-whatsapp-contact="${escapeHtml(profile.id)}" data-whatsapp-phone="${escapeHtml(phone)}">Conversar via WhatsApp</button>`
    : '';

  return `<article class="profile" aria-labelledby="perfil-nome">
    <div class="profile-grid">
      ${profilePhoto}
      <div>
        <p class="eyebrow">Perfil público verificado</p>
        <h3 id="perfil-nome">${escapeHtml(profile.nome)}</h3>
        ${ratingBadge}
        <p><strong>Localização:</strong> ${escapeHtml(profile.localizacao, 'Localização não informada')}</p>
        <p><strong>Pacotes / Preço:</strong> ${escapeHtml(profile.preco, 'Sob consulta')}</p>
        <p>${escapeHtml(profile.bio, 'Este fotógrafo ainda não adicionou uma biografia.')}</p>
        <div class="tags">${(profile.especialidades || []).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('')}</div>
        ${paymentMethodsHtml}
      </div>
    </div>
    <div style="margin-top: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap;">
      <button class="button button-primary" type="button" data-request-quote="${escapeHtml(profile.id)}" data-professional-name="${escapeHtml(profile.nome)}">Solicitar orçamento</button>
      ${whatsAppButton}
    </div>
    <h4>Portfólio</h4>
    <div class="profile-gallery">${photos || '<p>Nenhuma foto disponível.</p>'}</div>
    <div class="reviews-section">
      <h4>Avaliações e Recomendações</h4>
      <div class="reviews-list">${reviewsHtml}</div>
      ${reviewFormHtml}
    </div>
  </article>`;
}

function renderCards(professionals) {
  if (!professionals.length) {
    list.innerHTML = '<p class="status">Nenhum fotógrafo encontrado para esses filtros.</p>';
    return;
  }
  list.innerHTML = professionals.map((professional) => {
    const photo = professional.foto
      ? `<img src="${escapeHtml(professional.foto)}" alt="Foto de perfil de ${escapeHtml(professional.nome)}" loading="lazy">`
      : '<div class="card-image" role="img" aria-label="Foto de perfil não informada"></div>';
    const ratingHtml = professional.media_nota
      ? `<div class="card-rating">★ ${professional.media_nota} <small>(${professional.total_avaliacoes || 0})</small></div>`
      : '<div class="card-rating">★ 5.0 <small>(Novo)</small></div>';

    const distanceBadge = professional.distancia_km != null
      ? `<span class="tag distance-tag" style="background: #e0f2fe; color: #0369a1; font-weight: 600; border: 1px solid #bae6fd;">📍 A ${professional.distancia_km.toFixed(1)} km de você</span>`
      : '';

    return `<article class="card">
      ${photo}
      <h3>${escapeHtml(professional.nome)}</h3>
      ${ratingHtml}
      <p>${escapeHtml(professional.localizacao, 'Localização não informada')}</p>
      <div class="tags">
        ${distanceBadge}
        ${(professional.especialidades || []).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('')}
      </div>
      <div class="card-actions">
        <button class="button button-primary" type="button" data-profile-id="${escapeHtml(professional.id)}">Ver perfil público</button>
      </div>
    </article>`;
  }).join('');
}

// Interactive Map Support (Leaflet + OpenStreetMap)
function initMap(professionals) {
  if (typeof L === 'undefined') return;
  if (!mapContainer) return;

  if (!leafletMap) {
    leafletMap = L.map(mapContainer).setView([-23.5505, -46.6333], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(leafletMap);
  }

  // Clear existing markers
  mapMarkers.forEach((m) => leafletMap.removeLayer(m));
  mapMarkers = [];

  const bounds = [];

  // Plot user location marker if GPS is active
  if (userCoordinates) {
    const userMarker = L.circleMarker([userCoordinates.lat, userCoordinates.lng], {
      radius: 9,
      fillColor: '#2563eb',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    }).addTo(leafletMap);
    userMarker.bindPopup('<strong>📍 Sua localização atual</strong>');
    mapMarkers.push(userMarker);
    bounds.push([userCoordinates.lat, userCoordinates.lng]);
  }

  professionals.forEach((p) => {
    if (p.latitude != null && p.longitude != null) {
      const marker = L.marker([p.latitude, p.longitude]).addTo(leafletMap);
      const distanceText = p.distancia_km != null ? `<span style="color: #0369a1; font-weight: 600;">📍 A ${p.distancia_km.toFixed(1)} km</span><br>` : '';
      const popupContent = `
        <div style="font-family: inherit; font-size: 0.9rem; min-width: 170px;">
          <strong>${escapeHtml(p.nome)}</strong><br>
          <span style="color: #d97706; font-weight: bold;">★ ${p.media_nota || '5.0'}</span><br>
          ${distanceText}
          <small>${escapeHtml(p.localizacao)}</small><br>
          <div style="margin-top: 0.4rem;">
            <button class="button button-primary" type="button" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; min-height: 1.8rem;" data-profile-id="${escapeHtml(p.id)}">Ver perfil</button>
          </div>
        </div>
      `;
      marker.bindPopup(popupContent);
      mapMarkers.push(marker);
      bounds.push([p.latitude, p.longitude]);
    }
  });

  if (bounds.length > 0) {
    leafletMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  }
}

if (mapToggleBtn) {
  mapToggleBtn.addEventListener('click', () => {
    const isHidden = mapContainer.style.display === 'none';
    mapContainer.style.display = isHidden ? 'block' : 'none';
    mapToggleBtn.textContent = isHidden ? '✕ Ocultar mapa' : '🗺️ Alternar mapa interativo';
    if (isHidden) {
      setTimeout(() => {
        initMap(currentProfessionals);
        leafletMap?.invalidateSize();
      }, 100);
    }
  });
}

if (gpsBtn) {
  gpsBtn.addEventListener('click', () => {
    if (userCoordinates) {
      userCoordinates = null;
      gpsBtn.textContent = '📍 Perto de mim (GPS)';
      gpsBtn.style.background = '';
      gpsBtn.style.color = '';
      loadProfessionals();
      return;
    }

    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador.');
      return;
    }

    gpsBtn.textContent = '📍 Localizando...';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userCoordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        gpsBtn.textContent = '📍 GPS Ativo (Limpar)';
        gpsBtn.style.background = 'var(--primary-color, #1e293b)';
        gpsBtn.style.color = '#ffffff';
        loadProfessionals();
      },
      (error) => {
        gpsBtn.textContent = '📍 Perto de mim (GPS)';
        alert(`Não foi possível obter sua localização: ${error.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}

async function loadProfessionals(event) {
  event?.preventDefault();
  searchStatus.textContent = 'Buscando fotógrafos...';
  const params = new URLSearchParams(new FormData(searchForm));
  if (userCoordinates) {
    params.set('lat', userCoordinates.lat);
    params.set('lng', userCoordinates.lng);
  }
  try {
    const response = await fetch(`/api/profissionais?${params}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível carregar a vitrine.');
    currentProfessionals = data.profissionais || [];
    renderCards(currentProfessionals);
    const gpsExtra = userCoordinates ? ' (ordenados por proximidade geográfica)' : '';
    searchStatus.textContent = `${currentProfessionals.length} fotógrafo(s) encontrado(s)${gpsExtra}.`;
    if (mapContainer && mapContainer.style.display !== 'none') {
      initMap(currentProfessionals);
    }
  } catch (error) {
    list.innerHTML = '';
    searchStatus.textContent = `Erro: ${error.message}`;
  }
}

async function loadProfile(id) {
  searchStatus.textContent = 'Carregando perfil...';
  try {
    const response = await fetch(`/api/profissionais/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Perfil não encontrado.');
    list.innerHTML = renderProfile(data.profissional) + '<div style="margin-top: 2rem;"><button class="button button-primary" type="button" id="voltar-lista">Voltar para a busca</button></div>';
    searchStatus.textContent = 'Perfil carregado.';
    document.querySelector('#voltar-lista')?.focus();
  } catch (error) {
    searchStatus.textContent = `Erro: ${error.message}`;
  }
}

// Global click handling
document.addEventListener('click', async (event) => {
  const profileButton = event.target.closest('[data-profile-id]');
  if (profileButton) {
    loadProfile(profileButton.dataset.profileId);
    return;
  }

  if (event.target.id === 'voltar-lista') {
    loadProfessionals();
    return;
  }

  const quoteButton = event.target.closest('[data-request-quote]');
  if (quoteButton) {
    const profId = Number(quoteButton.dataset.requestQuote);
    const profName = quoteButton.dataset.professionalName;

    if (!currentUserData) {
      sessionStorage.setItem('fotecta_pending_quote', JSON.stringify({ id: profId, name: profName }));
      alert('Para solicitar um orçamento e conversar diretamente pelo chat, por favor entre na sua conta ou faça seu cadastro.');
      window.location.hash = 'login';
      return;
    }

    if (currentUserData.id === profId) {
      alert('Você não pode solicitar um orçamento para o seu próprio perfil profissional.');
      return;
    }

    quoteProfessional.value = profId;
    quoteProfessionalName.textContent = `Profissional selecionado: ${profName}`;
    quoteSection.hidden = false;
    quoteSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelector('#orcamento-titulo').focus();
    return;
  }

  const whatsappButton = event.target.closest('[data-whatsapp-contact]');
  if (whatsappButton) {
    try {
      await apiFetch(`/api/users/${whatsappButton.dataset.whatsappContact}/click-whatsapp`, { method: 'POST' });
      const rawPhone = whatsappButton.dataset.whatsappPhone || '';
      const cleanPhone = rawPhone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const text = encodeURIComponent('Olá! Encontrei seu perfil no Fotecta e gostaria de solicitar um orçamento para fotos.');
        window.open(`https://wa.me/55${cleanPhone}?text=${text}`, '_blank');
      } else {
        alert('Simulação de WhatsApp: Redirecionando para conversa direta com o profissional.');
      }
    } catch (_) {}
    return;
  }

  const chatOpenBtn = event.target.closest('[data-open-chat]');
  if (chatOpenBtn) {
    if (!currentUserData) {
      alert('Você precisa estar conectado para acessar o chat.');
      window.location.href = '#login';
      return;
    }
    openChat(chatOpenBtn.dataset.openChat, chatOpenBtn.dataset.chatTitle, chatOpenBtn.dataset.chatUser);
    return;
  }
});

// Chat Management
async function openChat(projectId, projectTitle, otherParty) {
  if (!currentUserData) {
    closeChat();
    return;
  }
  if (chatPollTimer) {
    clearInterval(chatPollTimer);
    chatPollTimer = null;
  }
  chatProjectIdInput.value = projectId;
  chatTitle.textContent = projectTitle;
  chatParticipants.textContent = `Conversa com: ${otherParty}`;
  chatSection.hidden = false;
  chatSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  await loadChatMessages(projectId, false);

  // Real-time silent chat auto-polling every 3 seconds
  chatPollTimer = setInterval(() => {
    if (chatSection && !chatSection.hidden && chatProjectIdInput.value === projectId) {
      loadChatMessages(projectId, true);
    } else {
      clearInterval(chatPollTimer);
      chatPollTimer = null;
    }
  }, 3000);
}

async function loadChatMessages(projectId, silent = false) {
  if (!silent) {
    chatMessagesContainer.innerHTML = '<p class="status">Carregando mensagens...</p>';
  }
  try {
    const data = await apiFetch(`/api/projetos/${projectId}/mensagens`);
    const msgs = data.mensagens || [];
    const isAtBottom = (chatMessagesContainer.scrollHeight - chatMessagesContainer.scrollTop - chatMessagesContainer.clientHeight) < 60;
    if (!msgs.length) {
      chatMessagesContainer.innerHTML = '<p class="status">Nenhuma mensagem trocada ainda. Inicie a conversa abaixo.</p>';
      return;
    }
    const rendered = msgs.map((m) => `
      <div class="chat-msg ${m.is_me ? 'mine' : 'other'}">
        <strong>${escapeHtml(m.remetente_nome)}</strong>
        <span>${escapeHtml(m.texto)}</span>
        <small style="opacity: 0.7; font-size: 0.75rem;">${new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
      </div>
    `).join('');
    if (chatMessagesContainer.innerHTML !== rendered) {
      chatMessagesContainer.innerHTML = rendered;
      if (isAtBottom || !silent) {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
      }
    }
  } catch (error) {
    if (!silent) {
      chatMessagesContainer.innerHTML = `<p class="status">Erro ao carregar mensagens: ${escapeHtml(error.message)}</p>`;
    }
  }
}

if (chatCloseBtn) {
  chatCloseBtn.addEventListener('click', closeChat);
}

if (chatDenounceBtn) {
  chatDenounceBtn.addEventListener('click', async () => {
    const projId = chatProjectIdInput.value;
    if (!projId) return;
    const motivo = prompt('Descreva o motivo da denúncia para a equipe de moderação (ex: conduta abusiva, fraude, assédio):');
    if (!motivo || !motivo.trim()) return;
    try {
      const res = await apiFetch(`/api/projetos/${projId}/denunciar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      alert(res.message || 'Denúncia registrada com sucesso. A equipe do FOTECTA irá analisar.');
    } catch (err) {
      alert('Erro ao registrar denúncia: ' + err.message);
    }
  });
}

if (chatForm) {
  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const projectId = chatProjectIdInput.value;
    const textVal = chatTextInput.value.trim();
    if (!textVal || !projectId) return;

    await withSubmitLock(chatForm, async () => {
      chatTextInput.value = '';
      try {
        await apiFetch(`/api/projetos/${projectId}/mensagens`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ texto: textVal }),
        });
        await loadChatMessages(projectId, true);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
      } catch (error) {
        chatTextInput.value = textVal; // restore on failure
        alert(`Erro ao enviar mensagem: ${error.message}`);
      }
    });
  });
}

// Review submission from profile
document.addEventListener('submit', async (event) => {
  const reviewForm = event.target.closest('#form-enviar-avaliacao');
  if (reviewForm) {
    event.preventDefault();
    const profId = reviewForm.dataset.profId;
    const statusEl = reviewForm.querySelector('#review-status');
    const note = reviewForm.querySelector('#review-nota').value;
    const comment = reviewForm.querySelector('#review-comentario').value.trim();
    statusEl.textContent = 'Enviando avaliação...';
    await withSubmitLock(reviewForm, async () => {
      try {
        await apiFetch(`/api/profissionais/${profId}/avaliar`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ nota: note, comentario: comment }),
        });
        statusEl.textContent = 'Avaliação enviada com sucesso!';
        setTimeout(() => loadProfile(profId), 800);
      } catch (error) {
        statusEl.textContent = `Erro: ${error.message}`;
      }
    });
    return;
  }

  // Reply to review from photographer dashboard
  const replyForm = event.target.closest('.review-reply-form');
  if (replyForm) {
    event.preventDefault();
    const reviewId = replyForm.dataset.reviewId;
    const input = replyForm.querySelector('input');
    const resposta = input.value.trim();
    if (!resposta) return;
    try {
      await apiFetch(`/api/avaliacoes/${reviewId}/responder`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resposta }),
      });
      await loadPhotographerDashboard();
    } catch (error) {
      alert(`Erro ao responder: ${error.message}`);
    }
  }
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearSignupErrors();
  const errors = validateSignup();
  if (errors.length) {
    showSignupErrors(errors);
    signupStatus.textContent = 'Corrija os campos indicados antes de continuar.';
    return;
  }
  signupStatus.textContent = 'Enviando cadastro...';
  const payload = Object.fromEntries(new FormData(signupForm));
  await withSubmitLock(signupForm, async () => {
    try {
      const response = await fetch('/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível concluir o cadastro.');
      signupStatus.textContent = 'Cadastro concluído com sucesso.';
      signupForm.reset();
      renderSession(data.user);
      if (data.user.tipo === 'admin') {
        window.location.href = '/admin';
        return;
      }
      if (data.user.tipo === 'fotografo') {
        photographerDashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.location.hash = 'dashboard-fotografo';
      } else {
        dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.location.hash = 'dashboard-logado';
      }
    } catch (error) {
      signupStatus.textContent = `Erro: ${error.message}`;
    }
  });
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginErrors.hidden = true;
  loginEmailInput.removeAttribute('aria-invalid');
  loginPasswordInput.removeAttribute('aria-invalid');
  if (!validEmail(loginEmailInput.value) || !loginPasswordInput.value) {
    if (!validEmail(loginEmailInput.value)) loginEmailInput.setAttribute('aria-invalid', 'true');
    if (!loginPasswordInput.value) loginPasswordInput.setAttribute('aria-invalid', 'true');
    showFormError(loginErrors, 'Informe um e-mail válido e uma senha.');
    return;
  }
  loginStatus.textContent = 'Entrando...';
  const payload = Object.fromEntries(new FormData(loginForm));
  await withSubmitLock(loginForm, async () => {
    try {
      const response = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível entrar.');
      loginStatus.textContent = `Login realizado. Olá, ${data.user.nome}.`;
      loginForm.reset();
      renderSession(data.user);
      if (data.user.tipo === 'admin') {
        window.location.href = '/admin';
        return;
      }
      if (data.user.tipo === 'fotografo') {
        photographerDashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.location.hash = 'dashboard-fotografo';
      } else {
        dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.location.hash = 'dashboard-logado';
      }
    } catch (error) {
      loginStatus.textContent = '';
      showFormError(loginErrors, explainFetchError(error));
    }
  });
});

if (clientProfileForm) {
  clientProfileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (clientProfileStatus) clientProfileStatus.textContent = 'Salvando dados pessoais...';
    const payload = Object.fromEntries(new FormData(clientProfileForm));
    await withSubmitLock(clientProfileForm, async () => {
      try {
        const data = await apiFetch('/api/me', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (clientProfileStatus) clientProfileStatus.textContent = data.message || 'Dados atualizados com sucesso!';
        currentUserData = data.user;
        renderSession(currentUserData);
      } catch (error) {
        if (clientProfileStatus) clientProfileStatus.textContent = `Erro: ${error.message}`;
      }
    });
  });
}

recoveryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validEmail(recoveryEmailInput.value)) {
    recoveryEmailInput.setAttribute('aria-invalid', 'true');
    recoveryStatus.textContent = 'Informe um e-mail válido para solicitar a recuperação.';
    recoveryEmailInput.focus();
    return;
  }
  recoveryEmailInput.removeAttribute('aria-invalid');
  recoveryStatus.textContent = 'Enviando solicitação...';
  const payload = Object.fromEntries(new FormData(recoveryForm));
  await withSubmitLock(recoveryForm, async () => {
    try {
      const response = await fetch('/api/password-reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível enviar a solicitação.');
      recoveryStatus.textContent = data.message;
      recoveryForm.reset();
    } catch (error) {
      recoveryStatus.textContent = `Erro: ${explainFetchError(error)}`;
    }
  });
});

photographerProfileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#perfil-fotografo-status');
  status.textContent = 'Salvando perfil...';
  await withSubmitLock(photographerProfileForm, async () => {
    try {
      const formData = new FormData(photographerProfileForm);
      const metodos = formData.getAll('metodosPagamento');
      formData.delete('metodosPagamento');
      formData.append('metodosPagamento', JSON.stringify(metodos));
      const data = await apiFetch('/api/fotografo/perfil', { method: 'PUT', body: formData });
      status.textContent = data.message;
      await loadSession();
    } catch (error) {
      status.textContent = `Erro: ${error.message}`;
    }
  });
});

portfolioForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#portfolio-status');
  status.textContent = 'Enviando fotografia...';
  await withSubmitLock(portfolioForm, async () => {
    try {
      const data = await apiFetch('/api/fotografo/portfolio', { method: 'POST', body: new FormData(portfolioForm) });
      status.textContent = 'Fotografia adicionada ao portfólio.';
      portfolioForm.reset();
      await loadPhotographerDashboard();
    } catch (error) {
      status.textContent = `Erro: ${error.message}`;
    }
  });
});

portfolioList.addEventListener('click', async (event) => {
  const saveButton = event.target.closest('[data-save-portfolio]');
  if (saveButton) {
    const id = saveButton.dataset.savePortfolio;
    const category = portfolioList.querySelector(`[data-edit-category="${id}"]`).value;
    const caption = portfolioList.querySelector(`[data-edit-caption="${id}"]`).value.trim();
    try {
      await apiFetch(`/api/fotografo/portfolio/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ categoria: category, legenda: caption }) });
      saveButton.textContent = 'Alterações salvas';
    } catch (error) {
      portfolioList.insertAdjacentHTML('afterbegin', `<p class="status">Erro ao salvar: ${escapeHtml(error.message)}</p>`);
    }
    return;
  }
  const button = event.target.closest('[data-delete-portfolio]');
  if (!button || !window.confirm('Excluir esta fotografia do portfólio?')) return;
  try {
    await apiFetch(`/api/fotografo/portfolio/${button.dataset.deletePortfolio}`, { method: 'DELETE' });
    await loadPhotographerDashboard();
  } catch (error) {
    portfolioList.insertAdjacentHTML('afterbegin', `<p class="status">Erro ao excluir: ${escapeHtml(error.message)}</p>`);
  }
});

quoteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUserData) {
    quoteStatus.textContent = 'Você precisa estar conectado para enviar uma solicitação.';
    alert('Por favor, entre na sua conta ou crie um cadastro para solicitar um orçamento.');
    window.location.hash = 'login';
    return;
  }
  quoteStatus.textContent = 'Enviando solicitação...';
  const payload = Object.fromEntries(new FormData(quoteForm));
  if (!payload.profissionalId || !payload.titulo || !payload.descricao || !payload.cidade || !payload.estado) {
    quoteStatus.textContent = 'Preencha os campos obrigatórios antes de enviar.';
    return;
  }
  await withSubmitLock(quoteForm, async () => {
    try {
      await apiFetch('/api/projetos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      quoteStatus.textContent = 'Solicitação enviada. Você pode acompanhar e conversar no seu painel.';
      quoteForm.reset();
      if (currentUserData) loadClientDashboard();
    } catch (error) {
      quoteStatus.textContent = `Erro: ${escapeHtml(error.message)}`;
    }
  });
});

projectsList.addEventListener('change', async (event) => {
  const select = event.target.closest('[data-project-status]');
  if (!select) return;
  try {
    await apiFetch(`/api/projetos/${select.dataset.projectStatus}/status`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: select.value }) });
  } catch (error) {
    projectsList.insertAdjacentHTML('afterbegin', `<p class="status">Erro ao atualizar status: ${escapeHtml(error.message)}</p>`);
  }
});

emailInput.addEventListener('input', updateEmailState);
passwordInput.addEventListener('input', updatePasswordState);

// Avatar Modal & Profile Photo Management Listeners
const modalFoto = document.querySelector('#modal-foto-perfil');
const modalFecharBtn = document.querySelector('#modal-foto-fechar');
const modalEscolherBtn = document.querySelector('#modal-btn-escolher');
const modalRemoverBtn = document.querySelector('#modal-btn-remover');
const modalFileInput = document.querySelector('#modal-foto-input');
const dashBtnAjustar = document.querySelector('#dash-btn-ajustar-foto');
const dashBtnRemover = document.querySelector('#dash-btn-remover-foto');
const fotografoBtnRemover = document.querySelector('#fotografo-btn-remover-foto');

if (modalFecharBtn) modalFecharBtn.addEventListener('click', closeAvatarModal);
if (modalEscolherBtn && modalFileInput) {
  modalEscolherBtn.addEventListener('click', () => modalFileInput.click());
}
if (modalFileInput) {
  modalFileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleAvatarUpload(file);
  });
}
if (modalRemoverBtn) modalRemoverBtn.addEventListener('click', handleAvatarRemove);

if (modalFoto) {
  modalFoto.addEventListener('click', (e) => {
    if (e.target === modalFoto) closeAvatarModal();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalFoto && !modalFoto.hidden) {
    closeAvatarModal();
  }
});

if (dashBtnAjustar) dashBtnAjustar.addEventListener('click', openAvatarModal);
if (dashBtnRemover) dashBtnRemover.addEventListener('click', handleAvatarRemove);
if (fotografoBtnRemover) fotografoBtnRemover.addEventListener('click', handleAvatarRemove);

searchForm.addEventListener('submit', loadProfessionals);

// SPA Router via HashChange and Pathname (Back/Forward navigation and direct URLs)
function handleRoute() {
  const hash = window.location.hash || '';
  const pathname = window.location.pathname || '';
  let target = hash;
  if (!target) {
    if (pathname === '/login') target = '#login';
    else if (pathname === '/cadastro') target = '#cadastro';
    else if (pathname === '/busca') target = '#busca';
    else if (pathname === '/sobrenos') target = '#sobrenos';
    else if (pathname === '/fotografologado') target = '#dashboard-fotografo';
    else if (pathname === '/clientelogado') target = '#dashboard-logado';
    else target = '#inicio';
  }

  if (target === '#sobrenos') {
    document.querySelector('#sobrenos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (target === '#chat-secao') {
    if (chatSection && !chatSection.hidden) {
      chatSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }
  if (target === '#dashboard-fotografo') {
    if (photographerDashboard && !photographerDashboard.hidden) {
      photographerDashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }
  if (target === '#dashboard-logado') {
    if (dashboard && !dashboard.hidden) {
      dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }
  if (target === '#busca') {
    document.querySelector('#busca')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (target === '#orcamento') {
    if (quoteSection && !quoteSection.hidden) {
      quoteSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }
  if (target === '#login') {
    if (loginSection && !loginSection.hidden) {
      loginSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      loginEmailInput?.focus();
    }
    return;
  }
  if (target === '#cadastro') {
    if (signupSection && !signupSection.hidden) {
      signupSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelector('#cadastro-nome')?.focus();
    }
    return;
  }
  if (target === '#inicio' || target === '') {
    document.querySelector('#inicio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Input Masking for Phone and CPF (MER entity attributes & accessibility)
function maskCpf(value) {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

function setupInputMasks() {
  const cpfSelectors = ['#cadastro-cpf', '#cliente-cpf', '#fotografo-cpf'];
  const phoneSelectors = ['#cadastro-telefone', '#cliente-telefone', '#fotografo-telefone'];

  cpfSelectors.forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.addEventListener('input', (e) => {
      e.target.value = maskCpf(e.target.value);
    });
  });

  phoneSelectors.forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.addEventListener('input', (e) => {
      e.target.value = maskPhone(e.target.value);
    });
  });
}

window.addEventListener('hashchange', handleRoute);

loadSession();
loadProfessionals();
setupInputMasks();

