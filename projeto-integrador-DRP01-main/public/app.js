function setMessage(type, text) {
  const el = document.getElementById('message');
  if (!el) return;
  el.className = `message ${type}`;
  el.textContent = text;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok && !data.ok) {
    throw new Error(data.message || 'Erro ao processar a requisição.');
  }

  return data;
}

async function loadUsers() {
  const container = document.getElementById('users-list');
  if (!container) return;

  try {
    const data = await api('/api/users');
    container.innerHTML = '';
    data.users.forEach((user) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <div class="profile">
          <div class="avatar">${(user.nome || 'U').slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>${user.nome || 'Usuário'}</strong><br>
            <small>${user.email || ''}</small>
          </div>
        </div>
        <p>${user.bio || 'Sem biografia.'}</p>
        <div class="badge">${user.tipo || 'cliente'}</div>
        <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <span>Favoritos: ${user.favorited_by_count || 0}</span>
          <a href="/login" style="color: #2563eb; text-decoration: none;">Ver perfil</a>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    setMessage('error', error.message);
  }
}

async function loginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('email')?.value;
  const senha = document.getElementById('senha')?.value;

  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });

    if (data.ok) {
      const tipo = String(data.user.tipo || '').toLowerCase();
      if (tipo === 'admin') window.location.href = '/admin';
      else if (tipo === 'fotografo') window.location.href = '/fotografologado';
      else window.location.href = '/clientelogado';
      return;
    }

    setMessage('error', data.message || 'Falha no login.');
  } catch (error) {
    setMessage('error', error.message);
  }
}

async function registerSubmit(event) {
  event.preventDefault();
  const payload = {
    nome: document.getElementById('nome')?.value,
    email: document.getElementById('email')?.value,
    senha: document.getElementById('senha')?.value,
    tipo: document.getElementById('tipo')?.value || 'cliente',
  };

  try {
    const data = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (data.ok) {
      setMessage('success', 'Cadastro realizado com sucesso!');
      setTimeout(() => window.location.href = '/clientelogado', 800);
      return;
    }

    setMessage('error', data.message || 'Não foi possível cadastrar.');
  } catch (error) {
    setMessage('error', error.message);
  }
}

async function loadMe() {
  try {
    const user = await api('/api/me');
    const el = document.getElementById('user-name');
    if (el && user.user) {
      el.textContent = `Olá, ${user.user.nome}`;
    }
  } catch (error) {
    console.error(error);
  }
}

const loginForm = document.getElementById('login-form');
if (loginForm) loginForm.addEventListener('submit', loginSubmit);

const registerForm = document.getElementById('register-form');
if (registerForm) registerForm.addEventListener('submit', registerSubmit);

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('users-list')) loadUsers();
  loadMe();
});
