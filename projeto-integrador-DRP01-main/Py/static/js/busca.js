document.addEventListener('DOMContentLoaded', () => {
    if (!window.Auth) return;

    const listaFotografos = document.getElementById('listaFotografos');
    const buscaInput = document.getElementById('buscaInput');
    const msgSemResultados = document.getElementById('msgSemResultados');
    const btnFiltros = document.querySelectorAll('#filtrosEspecialidade button');
    let todosFotografos = [];
    const debounce = (window.UIHelpers && window.UIHelpers.debounce) || ((fn) => fn);
    const i18n = (window.UIHelpers && window.UIHelpers.getI18n) || (() => ({ favorite: 'Favoritar', unfavorite: 'Remover dos favoritos', cannot_favorite_self: 'Você não pode favoritar seu próprio perfil' }));

    let currentUser = null;
    let favoritos = [];
    let especialidadeAtual = '';

    function renderPortfolio(portfolio = []) {
        if (portfolio.length === 0) {
            return '<p class="text-muted small mb-0 mt-3 text-center bg-light rounded py-3">Nenhuma foto no portfólio ainda.</p>';
        }

        return `<div class="row g-2 mt-2">${portfolio.map((foto) => `<div class="col-4"><div class="rounded shadow-sm portfolio-thumb" data-foto="${foto}"></div></div>`).join('')}</div>`;
    }

    function renderNota(avaliacoes = []) {
        if (avaliacoes.length === 0) return '<div class="small text-muted mb-1 nota-small">Novo na plataforma</div>';
        const soma = avaliacoes.reduce((acc, av) => acc + (av.nota || 5), 0);
        const media = (soma / avaliacoes.length).toFixed(1);
        return `<div class="small mb-1 nota-small"><span class="text-warning">${'⭐'.repeat(Math.round(media))}</span> <span class="text-muted fw-semibold ms-1">${media} (${avaliacoes.length})</span></div>`;
    }

    async function syncUser() {
        currentUser = await (window.Auth.loadCurrentUser ? window.Auth.loadCurrentUser() : window.Auth.refreshCurrentUser());
        favoritos = currentUser ? (currentUser.favoritos || []) : [];
    }

    function renderCards(fotografos) {
        listaFotografos.innerHTML = '';
        if (fotografos.length === 0) {
            msgSemResultados.classList.remove('d-none');
            return;
        }

        msgSemResultados.classList.add('d-none');

        fotografos.forEach((fotografo) => {
            const isFav = favoritos.includes(fotografo.email);
            const canFavorite = !(currentUser && currentUser.tipo === 'fotografo' && String(currentUser.email).toLowerCase() === String(fotografo.email).toLowerCase());
            const tooltip = isFav ? i18n().unfavorite : i18n().favorite;
            const buttonAttrs = canFavorite
                ? `data-bs-toggle="tooltip" data-bs-placement="left" title="${tooltip}" aria-pressed="${isFav ? 'true' : 'false'}" aria-label="${tooltip}"`
                : `disabled data-bs-toggle="tooltip" data-bs-placement="left" title="${i18n().cannot_favorite_self}" aria-label="${i18n().cannot_favorite_self}"`;

            const card = document.createElement('div');
            card.className = 'col-12 col-md-6 col-lg-4';
            card.innerHTML = `
                <div class="box p-4 h-100 d-flex flex-column position-relative">
                    <button class="btn btn-light btn-sm shadow-sm position-absolute top-0 end-0 m-3 btn-favoritar rounded-circle btn-favoritar-floating" data-id="${fotografo.id}" data-email="${fotografo.email}" ${buttonAttrs}>
                        <i class="fa-heart ${isFav ? 'fa-solid text-danger' : 'fa-regular text-muted'} fs-6"></i>
                    </button>
                    <div class="d-flex align-items-center gap-3 mb-3">
                        <div class="shadow-sm avatar-card" data-avatar="${fotografo.foto || ''}"></div>
                        <div>
                            <h3 class="h5 fw-bold mb-0">${fotografo.nome}</h3>
                            ${renderNota(fotografo.avaliacoes || [])}
                            <a href="mailto:${fotografo.email}" class="small text-decoration-none text-muted">${fotografo.email}</a>
                            <div class="mt-1 d-flex flex-wrap gap-1">${(fotografo.especialidades || []).map((esp) => `<span class="badge bg-light text-dark border fw-normal">${esp}</span>`).join(' ')}</div>
                            <p class="small text-muted mt-2 mb-0 fst-italic bio-preview">"${fotografo.bio ? (fotografo.bio.length > 80 ? `${fotografo.bio.substring(0, 80)}...` : fotografo.bio) : 'Nenhuma biografia cadastrada.'}"</p>
                        </div>
                    </div>
                    <div class="mt-auto">
                        <hr class="line my-2">
                        <div class="small fw-semibold text-muted">Amostra de Portfólio</div>
                        ${renderPortfolio(fotografo.portfolio || [])}
                    </div>
                    <a href="/perfil-publico?id=${fotografo.id}" class="btn btn-dark w-100 mt-4">Ver Perfil Completo</a>
                </div>
            `;

            card.querySelectorAll('.portfolio-thumb').forEach((thumb) => {
                const src = thumb.getAttribute('data-foto');
                if (src) thumb.style.backgroundImage = `url('${src}')`;
            });
            const avatarEl = card.querySelector('.avatar-card');
            if (avatarEl && fotografo.foto) avatarEl.style.backgroundImage = `url('${fotografo.foto}')`;
            listaFotografos.appendChild(card);
        });
    }

    function filtrarERenderizar() {
        const termo = buscaInput.value.toLowerCase().trim();
        const filtrados = todosFotografos.filter((fotografo) => {
            const matchNome = fotografo.nome.toLowerCase().includes(termo);
            const matchEsp = especialidadeAtual === '' || (fotografo.especialidades || []).includes(especialidadeAtual);
            return matchNome && matchEsp;
        });

        renderCards(filtrados);
    }

    (async () => {
        await syncUser();
        await (window.Auth.loadUsers ? window.Auth.loadUsers() : Promise.resolve());
        todosFotografos = window.Auth.getUsers().filter((user) => user.tipo === 'fotografo');
        filtrarERenderizar();
    })();

    buscaInput.addEventListener('input', debounce(filtrarERenderizar, 250));

    btnFiltros.forEach((btn) => {
        btn.addEventListener('click', (event) => {
            btnFiltros.forEach((item) => {
                item.classList.remove('btn-dark', 'active-filter');
                item.classList.add('btn-outline-dark');
            });

            event.currentTarget.classList.remove('btn-outline-dark');
            event.currentTarget.classList.add('btn-dark', 'active-filter');
            especialidadeAtual = event.currentTarget.getAttribute('data-esp');
            filtrarERenderizar();
        });
    });

    listaFotografos.addEventListener('click', async (event) => {
        const button = event.target.closest('.btn-favoritar');
        if (!button) return;

        const resolvedUser = await (window.Auth.loadCurrentUser ? window.Auth.loadCurrentUser() : window.Auth.refreshCurrentUser());
        if (!resolvedUser) {
            alert('Faça login para salvar fotógrafos nos seus favoritos.');
            return;
        }

        currentUser = resolvedUser;
        const email = button.getAttribute('data-email');
        if (currentUser.tipo === 'fotografo' && String(currentUser.email).toLowerCase() === String(email).toLowerCase()) {
            alert('Você não pode favoritar seu próprio perfil.');
            return;
        }

        favoritos = favoritos.includes(email)
            ? favoritos.filter((favEmail) => favEmail !== email)
            : [...favoritos, email];

        await window.Auth.updateUser(currentUser.id, { favoritos });

        const isNowFav = favoritos.includes(email);
        const tooltip = isNowFav ? i18n().unfavorite : i18n().favorite;
        button.setAttribute('aria-pressed', isNowFav ? 'true' : 'false');
        button.setAttribute('title', tooltip);
        button.setAttribute('aria-label', tooltip);

        try {
            const tip = bootstrap.Tooltip.getInstance(button);
            if (tip) {
                tip.hide();
                setTimeout(() => { try { tip.show(); } catch (e) {} }, 50);
            }
        } catch (e) {
            // Tooltip pode não existir em ambientes sem Bootstrap carregado.
        }

        filtrarERenderizar();
    });
});
