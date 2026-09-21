(function(){
    const fotografo = window.Auth && window.Auth.requireRole && window.Auth.requireRole('fotografo');
    if (!fotografo) return;
    const H = window.UIHelpers || {};
    const escapeHtml = H.escapeHtml || ((v) => String(v || ''));
    const renderStars = H.renderStars || ((score) => '⭐'.repeat(Number(score) || 5));
    const debounce = H.debounce || ((fn) => fn);

    document.getElementById('fotografoInfo').textContent = `Logado como ${fotografo.nome} (${fotografo.email}).`;
    const fotografoToastEl = document.getElementById('fotografoToast');
    const toastMessage = document.getElementById('toastMessage');
    const showToast = (msg, theme) => { toastMessage.textContent = msg; fotografoToastEl.className = `toast align-items-center border-0 text-bg-${theme} shadow-lg rounded-4`; new bootstrap.Toast(fotografoToastEl).show(); };

    // Avaliações
    const listaAvaliacoes = document.getElementById('listaAvaliacoes');
    let avaliacoes = fotografo.avaliacoes || [];
    const renderResposta = (av) => av.resposta ? `<div class="mt-2 p-2 bg-white border rounded"><div class="small fw-bold mb-1 text-muted"><i class="fa-solid fa-reply me-1"></i>Sua Resposta:</div><div class="small">${escapeHtml(av.resposta)}</div></div>` : '';

    function renderAvaliacaoItem(av, index) {
        return `
            <div class="p-3 border rounded bg-light">
                <div class="fw-bold small mb-1">${escapeHtml(av.cliente)} <span class="text-muted fw-normal float-end">${escapeHtml(av.data)}</span></div>
                <div class="mb-2 text-warning small">${renderStars(av.nota)}</div>
                <div class="small mb-2">${escapeHtml(av.texto)}</div>
                ${renderResposta(av)}
                <div class="text-end mt-2">
                    <button class="btn btn-sm btn-outline-danger btn-excluir-avaliacao me-2" data-index="${index}" title="Excluir Avaliação"><i class="fa-solid fa-trash"></i> Excluir</button>
                    <button class="btn btn-sm btn-outline-dark btn-responder" data-index="${index}">${av.resposta ? 'Editar Resposta' : 'Responder'}</button>
                </div>
            </div>
        `;
    }

    function renderAvaliacoes() { listaAvaliacoes.innerHTML = avaliacoes.length === 0 ? '<p class="text-muted small mb-0">Você ainda não possui avaliações.</p>' : avaliacoes.map(renderAvaliacaoItem).join(''); }
    renderAvaliacoes();

    // Modal responder
    const modalResponderEl = document.getElementById('modalResponder');
    const modalResponder = new bootstrap.Modal(modalResponderEl);
    const btnSalvarResposta = document.getElementById('btnSalvarResposta');
    const textoResposta = document.getElementById('textoResposta');
    const comentarioClienteText = document.getElementById('comentarioClienteText');
    let indexAvaliacaoAtual = null;

    listaAvaliacoes.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-responder')) {
            indexAvaliacaoAtual = parseInt(e.target.getAttribute('data-index'), 10);
            comentarioClienteText.textContent = avaliacoes[indexAvaliacaoAtual].texto;
            textoResposta.value = avaliacoes[indexAvaliacaoAtual].resposta || '';
            modalResponder.show();
        }
        if (e.target.closest('.btn-excluir-avaliacao')) {
            const btn = e.target.closest('.btn-excluir-avaliacao'); const idx = parseInt(btn.getAttribute('data-index'),10);
            if (confirm('Deseja realmente excluir esta avaliação? Essa ação não pode ser desfeita.')) {
                avaliacoes.splice(idx,1); window.Auth.updateUser(fotografo.id, { avaliacoes }); renderAvaliacoes(); showToast('Avaliação excluída com sucesso.', 'success');
            }
        }
    });

    btnSalvarResposta.addEventListener('click', () => { if (indexAvaliacaoAtual===null || !textoResposta.value.trim()) return; avaliacoes[indexAvaliacaoAtual].resposta = textoResposta.value.trim(); window.Auth.updateUser(fotografo.id, { avaliacoes }); renderAvaliacoes(); modalResponder.hide(); showToast('Resposta salva com sucesso e exibida no seu perfil.', 'success'); });

    // Portfólio
    const uploadPortfolio = document.getElementById('uploadPortfolio');
    const galeriaPortfolio = document.getElementById('galeriaPortfolio');
    const msgSemFotos = document.getElementById('msgSemFotos');
    const btnUploadLabel = document.getElementById('btnUploadLabel');
    const contadorFotos = document.getElementById('contadorFotos');
    let portfolio = fotografo.portfolio || [];

    function renderGaleria(){ galeriaPortfolio.innerHTML=''; contadorFotos.textContent = `${portfolio.length}/5 fotos permitidas`; if (portfolio.length>=5){ btnUploadLabel.classList.add('disabled'); uploadPortfolio.disabled=true; } else { btnUploadLabel.classList.remove('disabled'); uploadPortfolio.disabled=false; } if (portfolio.length===0){ msgSemFotos.classList.remove('d-none'); } else { msgSemFotos.classList.add('d-none'); portfolio.forEach((fotoBase64,index)=>{ const col = document.createElement('div'); col.className='col-6 col-md-4 col-lg-3'; col.innerHTML = `<div class="position-relative shadow-sm rounded overflow-hidden portfolio-tile" data-foto="${fotoBase64}"><button class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 rounded-circle shadow delete-photo-btn" data-index="${index}" title="Remover Foto"><i class="fa-solid fa-trash-can small"></i></button></div>`; const fotoEl = col.querySelector('.portfolio-tile'); if (fotoEl) fotoEl.style.backgroundImage = `url('${fotoBase64}')`; galeriaPortfolio.appendChild(col); }); } }
    renderGaleria();

    uploadPortfolio.addEventListener('change', (e)=>{ const files = Array.from(e.target.files); if (files.length===0) return; if (portfolio.length + files.length > 5) { showToast('Limite atingido: você pode manter até 5 fotos no portfólio.', 'warning'); uploadPortfolio.value=''; return; } let processed=0; files.forEach((file)=>{ const reader = new FileReader(); reader.onload = (ev)=>{ portfolio.push(ev.target.result); processed++; if (processed === files.length) { window.Auth.updateUser(fotografo.id, { portfolio }); renderGaleria(); } }; reader.readAsDataURL(file); }); uploadPortfolio.value=''; });

    galeriaPortfolio.addEventListener('click', (e)=>{ const btn = e.target.closest('button'); if (!btn) return; const index = parseInt(btn.getAttribute('data-index'),10); portfolio.splice(index,1); window.Auth.updateUser(fotografo.id, { portfolio }); renderGaleria(); });

    // Clientes
    const listaClientes = document.getElementById('listaClientes');
    const buscaClientes = document.getElementById('buscaClientes');
    const todosClientes = window.Auth.getUsers().filter((u)=>u.tipo === 'cliente');
    const renderClienteCard = (c) => {
        const interesses = c.interesses || 'Não especificou interesses.';
        return `
            <div class="col-12 col-md-6">
                <div class="p-3 border rounded shadow-sm h-100">
                    <div class="fw-bold mb-1">${escapeHtml(c.nome)}</div>
                    <div class="small text-muted mb-2"><i class="fa-regular fa-comment-dots me-1"></i>${escapeHtml(interesses)}</div>
                    <a href="mailto:${escapeHtml(c.email)}" class="btn btn-outline-dark btn-sm"><i class="fa-regular fa-envelope me-2"></i>Contatar</a>
                </div>
            </div>
        `;
    };

    function renderClientes(lista){ listaClientes.innerHTML = ''; if (lista.length === 0) { listaClientes.innerHTML = '<p class="text-muted small col-12">Nenhum cliente encontrado.</p>'; return; } listaClientes.innerHTML = lista.map(renderClienteCard).join(''); }
    renderClientes(todosClientes);

    const filtrarClientes = debounce((e)=>{ const termo = e.target.value.toLowerCase().trim(); renderClientes(todosClientes.filter((c)=> (c.interesses && c.interesses.toLowerCase().includes(termo)) || c.nome.toLowerCase().includes(termo))); }, 180);
    buscaClientes.addEventListener('input', filtrarClientes);

    document.getElementById('logoutFotografo').addEventListener('click', async ()=>{ try{ await window.Auth.logout(); } catch(e){} window.location.href = '/login'; });
})();
