(async function () {
    if (!window.Auth) return;

    const resolveUser = async () => (window.Auth.loadCurrentUser ? window.Auth.loadCurrentUser() : window.Auth.refreshCurrentUser());
    const escape = (value) => String(value || '');
    const listaFavoritos = document.getElementById('listaFavoritos');
    const listaExplorar = document.getElementById('listaExplorar');
    const buscaFotografos = document.getElementById('buscaFotografos');
    const textoAvaliacao = document.getElementById('textoAvaliacao');
    const notaAvaliacao = document.getElementById('notaAvaliacao');
    const btnSalvarAvaliacao = document.getElementById('btnSalvarAvaliacao');
    const modalAvaliar = new bootstrap.Modal(document.getElementById('modalAvaliar'));
    let fotografoParaAvaliar = null;

    let cliente = await resolveUser();
    if (!cliente) {
        window.Auth.requireRole && window.Auth.requireRole('cliente');
        return;
    }

    await (window.Auth.loadUsers ? window.Auth.loadUsers() : Promise.resolve());
    const todosFotografos = window.Auth.getUsers().filter((user) => user.tipo === 'fotografo');

    document.getElementById('clienteInfo').textContent = `Logado como ${cliente.nome} (${cliente.email}).`;

    function getFavoritos(user) {
        return (user && user.favoritos ? user.favoritos : []).map((item) => String(item).toLowerCase());
    }

    function renderFotografoCard(fotografo, mode) {
        if (mode === 'favoritos') {
            return `
                <div class="box p-4 h-100 d-flex flex-column border shadow-sm">
                    <div class="d-flex align-items-center gap-3 mb-3">
                        <div class="shadow-sm avatar-card-md" data-avatar="${fotografo.foto || ''}"></div>
                        <div>
                            <h3 class="h6 fw-bold mb-0">${fotografo.nome}</h3>
                            <a href="mailto:${fotografo.email}" class="small text-decoration-none text-muted">${fotografo.email}</a>
                        </div>
                    </div>
                    <div class="mb-4 d-flex flex-wrap gap-1">${(fotografo.especialidades || []).map((esp) => `<span class="badge bg-light text-dark border fw-normal">${esp}</span>`).join(' ')}</div>
                    <div class="mt-auto">
                        <a href="/perfil-publico?id=${fotografo.id}" class="btn btn-dark btn-sm w-100">Ver Perfil Completo</a>
                        <button class="btn btn-outline-dark btn-sm w-100 mt-2 btn-avaliar" data-id="${fotografo.id}">Deixar Avaliação</button>
                    </div>
                </div>
            `;
        }

        const fotosHtml = Array.from({ length: 3 }, (_, index) => `<div class="col-4"><div class="rounded shadow-sm portfolio-mini" data-foto="${(fotografo.portfolio || [])[index] || ''}"></div></div>`).join('');
        return `
            <div class="box p-3 h-100">
                <div class="d-flex align-items-center gap-3 mb-2">
                    <div class="shadow-sm rounded-circle avatar-card-sm" data-avatar="${fotografo.foto || ''}"></div>
                    <div>
                        <h3 class="h6 fw-bold mb-0">${fotografo.nome}</h3>
                        <div class="small text-muted"><i class="fa-solid fa-location-dot me-1"></i>${fotografo.localizacao || 'Localização não informada'}</div>
                    </div>
                </div>
                <div class="row g-1 mt-2">${fotosHtml}</div>
            </div>
        `;
    }

    function renderList(container, items, mode) {
        container.innerHTML = '';
        if (items.length === 0) {
            container.innerHTML = '<div class="col-12"><p class="text-muted mb-0">Você ainda não tem favoritos. Acesse a busca e clique no coração para salvar fotógrafos.</p></div>';
            return;
        }

        items.forEach((fotografo) => {
            const col = document.createElement('div');
            col.className = 'col-12 col-md-6 col-lg-4';
            col.innerHTML = renderFotografoCard(fotografo, mode);
            container.appendChild(col);
        });
    }

    function renderExplorar(lista) {
        listaExplorar.innerHTML = '';
        lista.forEach((fotografo) => {
            const col = document.createElement('div');
            col.className = 'col-12 col-md-6 col-lg-4';
            col.innerHTML = renderFotografoCard(fotografo, 'explorar');
            col.querySelectorAll('[data-avatar]').forEach((el) => {
                const src = el.getAttribute('data-avatar');
                if (src) el.style.backgroundImage = `url('${src}')`;
            });
            col.querySelectorAll('[data-foto]').forEach((el) => {
                const src = el.getAttribute('data-foto');
                if (src) el.style.backgroundImage = `url('${src}')`;
            });
            listaExplorar.appendChild(col);
        });
    }

    function renderFavoritos(user) {
        const favoritos = getFavoritos(user);
        const favoritosList = todosFotografos.filter((fotografo) => favoritos.includes(String(fotografo.email).toLowerCase()));
        renderList(listaFavoritos, favoritosList, 'favoritos');
    }

    renderFavoritos(cliente);
    renderExplorar(todosFotografos);

    listaFavoritos.addEventListener('click', (event) => {
        const button = event.target.closest('.btn-avaliar');
        if (!button) return;
        textoAvaliacao.value = '';
        fotografoParaAvaliar = button.dataset.id || null;
        modalAvaliar.show();
    });

    btnSalvarAvaliacao.addEventListener('click', async () => {
        if (!fotografoParaAvaliar) return;
        if (!textoAvaliacao.value.trim()) {
            alert('Digite um comentário antes de enviar sua avaliação.');
            return;
        }

        const fotografo = window.Auth.getUsers().find((user) => String(user.id) === String(fotografoParaAvaliar));
        if (fotografo) {
            const avaliacoes = fotografo.avaliacoes || [];
            avaliacoes.push({ cliente: cliente.nome, texto: textoAvaliacao.value.trim(), nota: parseInt(notaAvaliacao.value, 10), data: new Date().toLocaleDateString() });
            await window.Auth.updateUser(fotografo.id, { avaliacoes });
            alert('Avaliação enviada com sucesso! Obrigado pelo seu feedback.');
        }

        fotografoParaAvaliar = null;
        modalAvaliar.hide();
    });

    buscaFotografos.addEventListener('input', (event) => {
        const termo = event.target.value.toLowerCase().trim();
        renderExplorar(todosFotografos.filter((fotografo) => fotografo.nome.toLowerCase().includes(termo) || (fotografo.localizacao && fotografo.localizacao.toLowerCase().includes(termo))));
    });

    document.getElementById('logoutCliente').addEventListener('click', async () => {
        await window.Auth.logout();
        window.location.href = '/login';
    });

    // Recarrega a lista quando favoritos mudam em outra aba ou seção.
    const refreshFavoritos = async () => {
        const refreshed = await resolveUser();
        if (!refreshed) return;
        cliente = refreshed;
        renderFavoritos(cliente);
    };

    window.addEventListener('fotecta:user-updated', refreshFavoritos);
    window.addEventListener('focus', refreshFavoritos);
})();
