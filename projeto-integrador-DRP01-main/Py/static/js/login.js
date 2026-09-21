document.addEventListener('DOMContentLoaded', () => {
    if (!window.Auth) return;
    const email = document.getElementById('email');
    const senha = document.getElementById('senha');
    const toggleSenha = document.getElementById('toggleSenha');
    const btnEntrar = document.getElementById('btnEntrar');
    const btnEntrarText = document.getElementById('btnEntrarText');
    const btnEntrarSpinner = document.getElementById('btnEntrarSpinner');
    const forcaSenhaLogin = document.getElementById('forcaSenhaLogin');
    const txtForcaLogin = document.getElementById('txtForcaLogin');
    const loginSection = document.getElementById('loginSection');
    const loginToastEl = document.getElementById('loginToast');
    const toastMessage = document.getElementById('toastMessage');
    const loginSuccessAlert = document.getElementById('loginSuccessAlert');
    const emailErro = document.getElementById('emailErro');
    const senhaErro = document.getElementById('senhaErro');
    const listaCredenciais = document.getElementById('listaCredenciais');
    const esqueciSenha = document.getElementById('esqueciSenha');
    const avisoTentativas = document.getElementById('avisoTentativas');
    const forgotPasswordFlow = document.getElementById('forgotPasswordFlow');
    const emailRecuperacao = document.getElementById('emailRecuperacao');
    const btnEnviarRecuperacao = document.getElementById('btnEnviarRecuperacao');
    const btnVoltarLogin = document.getElementById('btnVoltarLogin');
    const nascimentoRecuperacao = document.getElementById('nascimentoRecuperacao');

    let tentativasSenha = 3;

    const atualizarForcaSenha = (valor) => {
        const leitura = window.Auth && window.Auth.passwordStrength
            ? window.Auth.passwordStrength(valor)
            : { score: 0, level: 'muito fraca', color: 'bg-danger' };
        forcaSenhaLogin.style.width = `${leitura.score}%`;
        forcaSenhaLogin.className = `progress-bar ${leitura.color}`;
        txtForcaLogin.textContent = `Força da senha: ${leitura.level}`;
    };

    const setLoading = (loading) => {
        btnEntrar.disabled = loading;
        btnEntrarText.textContent = loading ? 'Entrando...' : 'Entrar';
        btnEntrarSpinner.classList.toggle('d-none', !loading);
    };

    const setFieldError = (field, errorEl, message) => {
        errorEl.textContent = message || '';
        field.setAttribute('aria-invalid', message ? 'true' : 'false');
        field.classList.toggle('is-invalid', Boolean(message));
    };

    const validateEmail = () => {
        const valor = email.value.trim();
        if (!valor) { setFieldError(email, emailErro, 'Digite seu e-mail.'); return false; }
        const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
        if (!valido) { setFieldError(email, emailErro, 'Formato de e-mail inválido.'); return false; }
        setFieldError(email, emailErro, ''); return true;
    };

    const validateSenha = () => {
        const valor = senha.value;
        if (!valor) { setFieldError(senha, senhaErro, 'Digite sua senha.'); return false; }
        setFieldError(senha, senhaErro, ''); return true;
    };

    toggleSenha.addEventListener('click', () => {
        const escondida = senha.type === 'password';
        senha.type = escondida ? 'text' : 'password';
        toggleSenha.textContent = escondida ? '🙈 Ocultar' : '👁️ Mostrar';
        toggleSenha.setAttribute('aria-label', escondida ? 'Ocultar senha' : 'Mostrar senha');
    });

    email.addEventListener('input', validateEmail);
    senha.addEventListener('input', () => { validateSenha(); atualizarForcaSenha(senha.value); });

    const userAtual = window.Auth.currentUser();
    if (userAtual) { window.location.href = window.Auth.redirectForRole(userAtual.tipo); return; }

    if (listaCredenciais) {
        const fixed = (window.Auth && window.Auth.getFixedUsers) ? window.Auth.getFixedUsers() : [];
        fixed.forEach((u) => {
            const li = document.createElement('li'); li.className = 'd-flex justify-content-between align-items-center';
            const span = document.createElement('span'); span.textContent = `${u.nome}: ${u.email} / ${u.senha}`;
            const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn-sm btn-outline-secondary ms-2'; btn.textContent = 'Usar';
            btn.addEventListener('click', () => {
                email.value = u.email; senha.value = u.senha; atualizarForcaSenha(senha.value);
                setLoading(true);
                window.Auth.login(u.email, u.senha).then((res) => {
                    setLoading(false);
                    if (res && res.ok) { loginSuccessAlert.classList.remove('d-none'); setTimeout(() => window.location.href = window.Auth.redirectForRole(res.user.tipo), 800); }
                    else showToast(res && res.message ? res.message : 'Erro ao autenticar.', 'danger');
                }).catch((e) => { setLoading(false); showToast(String(e), 'danger'); });
            });
            li.appendChild(span); li.appendChild(btn); listaCredenciais.appendChild(li);
        });
    }

    const showToast = (msg, theme) => {
        toastMessage.textContent = msg;
        loginToastEl.className = `toast align-items-center border-0 text-bg-${theme} shadow-lg rounded-4`;
        new bootstrap.Toast(loginToastEl).show();
    };

    const doLogin = async () => {
        const emailValor = email.value.trim(); const senhaValor = senha.value;
        const emailOk = validateEmail(); const senhaOk = validateSenha();
        if (!emailOk || !senhaOk) { showToast('Revise os campos destacados e tente novamente.', 'warning'); return; }
        setLoading(true);
        const result = await window.Auth.login(emailValor, senhaValor).catch((e) => ({ ok: false, message: String(e) }));
        if (!result.ok) {
            setLoading(false); tentativasSenha--; setFieldError(senha, senhaErro, 'E-mail ou senha incorretos.');
            avisoTentativas.textContent = `Atenção: você ainda tem ${tentativasSenha} tentativa(s) de senha.`; avisoTentativas.classList.remove('d-none');
            showToast(result.message || 'Credenciais inválidas.', 'danger');
            if (tentativasSenha <= 0) {
                avisoTentativas.classList.add('d-none'); loginSection.classList.add('d-none'); forgotPasswordFlow.classList.remove('d-none'); emailRecuperacao.value = emailValor;
                showToast('Limite de tentativas atingido. Solicite a redefinição de senha.', 'warning');
            }
            return;
        }
        avisoTentativas.classList.add('d-none'); loginSuccessAlert.classList.remove('d-none'); setFieldError(email, emailErro, ''); setFieldError(senha, senhaErro, '');
        const redirect = (result && result.user) ? window.Auth.redirectForRole(result.user.tipo) : '/';
        setTimeout(() => { window.location.href = redirect; }, 2000);
    };

    btnEntrar.addEventListener('click', doLogin);
    esqueciSenha.addEventListener('click', (e) => { e.preventDefault(); loginSection.classList.add('d-none'); forgotPasswordFlow.classList.remove('d-none'); emailRecuperacao.value = email.value.trim(); });
    btnVoltarLogin.addEventListener('click', () => { forgotPasswordFlow.classList.add('d-none'); loginSection.classList.remove('d-none'); tentativasSenha = 3; avisoTentativas.classList.add('d-none'); });
    btnEnviarRecuperacao.addEventListener('click', async () => {
        if (!emailRecuperacao.value || !nascimentoRecuperacao.value) { showToast('Preencha sua data de nascimento.', 'warning'); return; }
        const res = await window.Auth.requestPasswordReset(emailRecuperacao.value, nascimentoRecuperacao.value);
        if (res.ok) { showToast(res.message, 'success'); btnVoltarLogin.click(); } else showToast(res.message || 'Erro ao solicitar recuperação.', 'danger');
    });
    document.getElementById('loginSection').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doLogin(); } });
    setLoading(false); atualizarForcaSenha('');
});
