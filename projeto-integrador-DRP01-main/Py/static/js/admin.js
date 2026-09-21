(async function(){
    const adminAtual = window.Auth && window.Auth.requireRole && window.Auth.requireRole('admin');
    if (!adminAtual) return;
    const H = window.UIHelpers || {};
    const escapeHtml = H.escapeHtml || ((v)=>String(v||''));
    const maskPassword = H.maskPassword || (()=>'••••••');
    const formatDateBR = H.formatDateBR || ((v)=>v||'-');
    const isFixedUserId = H.isFixedUserId || ((id)=>['u-admin','u-cliente','u-fotografo'].includes(id));

    const adminUser = document.getElementById('adminUser');
    const metricTotal = document.getElementById('metricTotal');
    const metricClientes = document.getElementById('metricClientes');
    const metricFotografos = document.getElementById('metricFotografos');
    const usuariosBody = document.getElementById('usuariosBody');
    const novoUsuarioForm = document.getElementById('novoUsuarioForm');
    const adminMsg = document.getElementById('adminMsg');
    const btnLogout = document.getElementById('btnLogout');
    const resetLogins = document.getElementById('resetLogins');
    const buscaUsuarios = document.getElementById('buscaUsuarios');
    const resetsBody = document.getElementById('resetsBody');
    const msgSemResets = document.getElementById('msgSemResets');
    const filtroButtons = { todos: document.getElementById('filtroTodos'), cliente: document.getElementById('filtroClientes'), fotografo: document.getElementById('filtroFotografos'), admin: document.getElementById('filtroAdmins') };
    let filtro = 'todos';

    let userIdParaExcluir = null; let userIdParaRevelar = null; const modalExcluirEl = document.getElementById('modalExcluir'); const modalExcluir = modalExcluirEl ? new bootstrap.Modal(modalExcluirEl) : null; const modalVerSenhaEl = document.getElementById('modalVerSenha'); const modalVerSenha = modalVerSenhaEl ? new bootstrap.Modal(modalVerSenhaEl) : null; const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao'); const btnConfirmarVerSenha = document.getElementById('btnConfirmarVerSenha'); const nomeUsuarioExcluir = document.getElementById('nomeUsuarioExcluir'); const senhaAdminModal = document.getElementById('senhaAdminModal'); const senhaAdminModalMsg = document.getElementById('senhaAdminModalMsg'); const senhaRevelada = new Set();

    adminUser.textContent = `Logado como ${adminAtual.nome} (${adminAtual.email}).`;
    function mostrarMensagem(msg, erro){ adminMsg.textContent = msg; adminMsg.className = erro ? 'small mt-2 text-danger' : 'small mt-2 text-success'; }

    function linhaUsuario(u){ const tr = document.createElement('tr'); const isFixo = isFixedUserId(u.id); const disabledAttr = isFixo ? 'disabled' : ''; const nomeSafe = escapeHtml(u.nome); const emailSafe = escapeHtml(u.email); const badgeTipo = `<span class="badge bg-light text-dark border text-capitalize">${escapeHtml(u.tipo)}</span>`; const senhaText = isFixo ? '<span class="badge bg-secondary">Oculta (conta fixa)</span>' : `<div class="small fw-semibold" data-role="senha-text" data-id="${u.id}">${senhaRevelada.has(u.id) ? escapeHtml(u.senha) : maskPassword(u.senha)}</div>`; const senhaActions = isFixo ? '' : `<div class="input-group input-group-sm mt-1"><input data-id="${u.id}" data-field="novaSenha" type="password" class="form-control" placeholder="Nova senha (opcional)"><button class="btn btn-outline-dark" data-action="toggle-senha" data-id="${u.id}" type="button">${senhaRevelada.has(u.id) ? 'Ocultar' : 'Ver'}</button></div>`;
        tr.innerHTML = `
            <td><input data-id="${u.id}" data-field="nome" class="form-control form-control-sm" value="${nomeSafe}" ${disabledAttr}></td>
            <td>
                <div class="mb-1">${badgeTipo}</div>
                <select data-id="${u.id}" data-field="tipo" class="form-select form-select-sm" ${disabledAttr}>
                    <option value="cliente" ${u.tipo==='cliente'?'selected':''}>Cliente</option>
                    <option value="fotografo" ${u.tipo==='fotografo'?'selected':''}>Fotógrafo</option>
                    <option value="admin" ${u.tipo==='admin'?'selected':''} ${isFixo ? '' : 'disabled'}>Admin</option>
                </select>
            </td>
            <td><input data-id="${u.id}" data-field="email" type="email" class="form-control form-control-sm" value="${emailSafe}" ${disabledAttr}></td>
            <td>${senhaText}${senhaActions}</td>
            <td class="text-end">
                ${isFixo ? '<span class="badge bg-secondary">Conta Fixa</span>' : `
                <button class="btn btn-outline-success btn-sm" data-action="salvar" data-id="${u.id}">Salvar</button>
                <button class="btn btn-outline-danger btn-sm" data-action="excluir" data-id="${u.id}">Excluir</button>
                `}
            </td>
        `;
        return tr;
    }

    function setFiltro(tipo){ filtro = tipo; Object.entries(filtroButtons).forEach(([key,btn])=>{ btn.classList.toggle('btn-dark', key===tipo); btn.classList.toggle('btn-outline-dark', key!==tipo); }); render(); }
    function usersFiltrados(users){ let resultado = users; if (filtro !== 'todos') resultado = resultado.filter((u)=> u.tipo===filtro); const termoBusca = buscaUsuarios.value.toLowerCase().trim(); if (termoBusca) resultado = resultado.filter((u)=> u.nome.toLowerCase().includes(termoBusca) || u.email.toLowerCase().includes(termoBusca)); return resultado; }

    function renderResets(){ const reqs = window.Auth.getResetRequests(); resetsBody.innerHTML=''; if (reqs.length===0) { msgSemResets.classList.remove('d-none'); } else { msgSemResets.classList.add('d-none'); reqs.forEach((r)=>{ const tr = document.createElement('tr'); tr.innerHTML = `<td>${escapeHtml(r.nome)}</td><td>${escapeHtml(r.email)}</td><td><span class="badge bg-light text-dark border">${formatDateBR(r.nascimento)}</span></td><td><button class="btn btn-outline-success btn-sm me-1" data-action="aprovar-reset" data-email="${escapeHtml(r.email)}" title="Aprovar">✔️</button><button class="btn btn-outline-danger btn-sm" data-action="reprovar-reset" data-email="${escapeHtml(r.email)}" title="Reprovar">❌</button></td>`; resetsBody.appendChild(tr); }); } }

    function render(){ const users = window.Auth.getUsers(); const clientes = users.filter((u)=>u.tipo==='cliente').length; const fotografos = users.filter((u)=>u.tipo==='fotografo').length; metricTotal.textContent=String(users.length); metricClientes.textContent=String(clientes); metricFotografos.textContent=String(fotografos); usuariosBody.innerHTML=''; usersFiltrados(users).forEach((u)=> usuariosBody.appendChild(linhaUsuario(u))); }

    await window.Auth.loadUsers();
    await window.Auth.loadResetRequests();

    novoUsuarioForm.addEventListener('submit', async (e)=>{ e.preventDefault(); const result = await window.Auth.createUser({ nome: document.getElementById('novoNome').value, email: document.getElementById('novoEmail').value, senha: document.getElementById('novaSenha').value, tipo: document.getElementById('novoTipo').value }, { allowAdminRole: false }); if (!result.ok) { mostrarMensagem(result.message, true); return; } novoUsuarioForm.reset(); mostrarMensagem('Usuário criado com sucesso.', false); render(); });

    buscaUsuarios.addEventListener('input', render);
    filtroButtons.todos.addEventListener('click', ()=>setFiltro('todos'));
    filtroButtons.cliente.addEventListener('click', ()=>setFiltro('cliente'));
    filtroButtons.fotografo.addEventListener('click', ()=>setFiltro('fotografo'));
    filtroButtons.admin.addEventListener('click', ()=>setFiltro('admin'));

    usuariosBody.addEventListener('click', async (e)=>{
        const btn = e.target.closest('button'); if (!btn) return; const id = btn.getAttribute('data-id'); const action = btn.getAttribute('data-action');
        if (action === 'toggle-senha') { if (isFixedUserId(id)) { mostrarMensagem('Senha de conta fixa nunca é exibida.', true); return; } if (senhaRevelada.has(id)) { senhaRevelada.delete(id); render(); return; } userIdParaRevelar = id; senhaAdminModal.value=''; senhaAdminModalMsg.textContent=''; modalVerSenha.show(); setTimeout(()=>senhaAdminModal.focus(),150); return; }
        if (action === 'excluir') { userIdParaExcluir = id; const nome = document.querySelector(`[data-id="${id}"][data-field="nome"]`).value; nomeUsuarioExcluir.textContent = nome; modalExcluir.show(); return; }
        if (action === 'salvar') { const nome = document.querySelector(`[data-id="${id}"][data-field="nome"]`).value; const tipo = document.querySelector(`[data-id="${id}"][data-field="tipo"]`).value; const email = document.querySelector(`[data-id="${id}"][data-field="email"]`).value; const novaSenhaEl = document.querySelector(`[data-id="${id}"][data-field="novaSenha"]`); const novaSenha = novaSenhaEl ? novaSenhaEl.value.trim() : ''; const payload = { nome, tipo, email }; if (novaSenha) payload.senha = novaSenha; const result = await window.Auth.updateUser(id, payload); if (!result.ok) { mostrarMensagem(result.message, true); return; } senhaRevelada.delete(id); mostrarMensagem('Usuário atualizado com sucesso.', false); render(); }
    });

    btnConfirmarVerSenha.addEventListener('click', async ()=>{ if (!userIdParaRevelar) return; const check = window.Auth.verifyAdminPassword((senhaAdminModal.value||'').trim()); if (!check.ok) { senhaAdminModalMsg.textContent = check.message; return; } senhaRevelada.add(userIdParaRevelar); userIdParaRevelar=null; senhaAdminModal.value=''; senhaAdminModalMsg.textContent=''; modalVerSenha.hide(); render(); });

    senhaAdminModal.addEventListener('keydown', (e)=>{ if (e.key==='Enter') { e.preventDefault(); btnConfirmarVerSenha.click(); } });
    modalVerSenhaEl.addEventListener('hidden.bs.modal', ()=>{ userIdParaRevelar=null; senhaAdminModal.value=''; senhaAdminModalMsg.textContent=''; });

    btnConfirmarExclusao.addEventListener('click', async ()=>{ if (!userIdParaExcluir) return; const result = await window.Auth.deleteUser(userIdParaExcluir); modalExcluir.hide(); if (!result.ok) { mostrarMensagem(result.message, true); return; } mostrarMensagem('Usuário removido com sucesso.', false); render(); });

    resetsBody.addEventListener('click', async (e)=>{ const btn = e.target.closest('button'); if (!btn) return; const action = btn.getAttribute('data-action'); const email = btn.getAttribute('data-email'); if (action === 'aprovar-reset') { await window.Auth.approveReset(email); mostrarMensagem('Senha de ' + email + ' resetada para fotecta123.', false); renderResets(); render(); } else if (action === 'reprovar-reset') { await window.Auth.rejectReset(email); mostrarMensagem('Solicitação de ' + email + ' reprovada.', false); renderResets(); } });

    btnLogout.addEventListener('click', async ()=>{ try{ await window.Auth.logout(); } catch(e){} window.location.href = '/login'; });
    resetLogins.addEventListener('click', async ()=>{ await window.Auth.resetSeed(); window.location.href = '/login'; });
    setFiltro('todos'); renderResets();
})();
