const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { app, ready } = require('../server.js');

test('GET /api/users retorna usuários', async () => {
  await ready;
  const res = await request(app).get('/api/users');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.ok(Array.isArray(res.body.users));
});

test('POST /api/login autentica usuário demo', async () => {
  await ready;
  const res = await request(app)
    .post('/api/login')
    .send({ email: 'cliente@fotecta.com', senha: 'cliente123' });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.user.email, 'cliente@fotecta.com');
});

test('GET /api/profissionais retorna lista com notas e geolocalizacao', async () => {
  await ready;
  const res = await request(app).get('/api/profissionais');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.ok(Array.isArray(res.body.profissionais));
  assert.ok(res.body.profissionais.length > 0);
  const prof = res.body.profissionais[0];
  assert.ok('media_nota' in prof);
  assert.ok('latitude' in prof);
  assert.ok('longitude' in prof);
});

test('GET /api/profissionais/:id retorna perfil com portfolio e avaliacoes', async () => {
  await ready;
  const res = await request(app).get('/api/profissionais/3');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.ok(Array.isArray(res.body.profissional.portfolio));
  assert.ok(Array.isArray(res.body.profissional.avaliacoes));
});

test('DELETE /api/me/foto remove foto de perfil do usuário autenticado', async () => {
  await ready;
  const agent = request.agent(app);
  await agent
    .post('/api/login')
    .send({ email: 'fotografo@fotecta.com', senha: 'foto123' });

  const res = await agent.delete('/api/me/foto');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.foto, null);
  assert.equal(res.body.user.foto, null);
});

test('PUT /api/me atualiza dados pessoais do usuário autenticado', async () => {
  await ready;
  const agent = request.agent(app);
  await agent
    .post('/api/login')
    .send({ email: 'cliente@fotecta.com', senha: 'cliente123' });

  const res = await agent
    .put('/api/me')
    .send({ nome: 'Cliente Atualizado', localizacao: 'Campinas, SP', interesses: 'Ensaios' });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.user.nome, 'Cliente Atualizado');
  assert.equal(res.body.user.localizacao, 'Campinas, SP');
});

test('POST /api/profissionais/:id/avaliar bloqueia autoavaliação (self-review)', async () => {
  await ready;
  const agent = request.agent(app);
  // Login as photographer (id: 3)
  await agent
    .post('/api/login')
    .send({ email: 'fotografo@fotecta.com', senha: 'foto123' });

  const res = await agent
    .post('/api/profissionais/3/avaliar')
    .send({ nota: 5, comentario: 'Tentando me autoavaliar...' });

  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
  assert.match(res.body.message, /próprio perfil/i);
});

test('POST /api/projetos rejeita data de evento no passado', async () => {
  await ready;
  const agent = request.agent(app);
  // Login as client
  await agent
    .post('/api/login')
    .send({ email: 'cliente@fotecta.com', senha: 'cliente123' });

  const res = await agent
    .post('/api/projetos')
    .send({
      profissionalId: 3,
      titulo: 'Ensaio no passado',
      descricao: 'Teste de validação de data',
      cidade: 'São Paulo',
      estado: 'SP',
      dataEvento: '2020-01-01',
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
  assert.match(res.body.message, /passado/i);
});

test('POST /api/projetos bloqueia auto-contratação (self-booking)', async () => {
  await ready;
  const agent = request.agent(app);
  // Login as photographer 3
  await agent
    .post('/api/login')
    .send({ email: 'fotografo@fotecta.com', senha: 'foto123' });

  const res = await agent
    .post('/api/projetos')
    .send({
      profissionalId: 3,
      titulo: 'Auto pedido',
      descricao: 'Tentando pedir orçamento para si mesmo',
      cidade: 'São Paulo',
      estado: 'SP',
      dataEvento: '2026-12-01',
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
  assert.match(res.body.message, /próprio perfil/i);
});

test('POST /api/projetos exige autenticação (bloqueia orçamento anônimo)', async () => {
  await ready;
  const res = await request(app)
    .post('/api/projetos')
    .send({
      profissionalId: 3,
      titulo: 'Orçamento anônimo',
      descricao: 'Sem login',
      cidade: 'São Paulo',
      estado: 'SP',
    });

  assert.equal(res.status, 401);
  assert.equal(res.body.ok, false);
});

test('GET /admin redireciona visitante não autenticado para /#login', async () => {
  await ready;
  const res = await request(app).get('/admin');
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/#login');
});

test('GET /api/profissionais?lat=...&lng=... calcula distância Haversine e ordena por proximidade', async () => {
  await ready;
  const res = await request(app).get('/api/profissionais?lat=-23.5505&lng=-46.6333');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.ok(res.body.profissionais.length > 0);
  const first = res.body.profissionais[0];
  assert.ok(typeof first.distancia_km === 'number');
  assert.ok(first.distancia_km >= 0);
});

test('PUT /api/me salva telefone, cpf e metodos_pagamento (entidades do MER)', async () => {
  await ready;
  const agent = request.agent(app);
  await agent
    .post('/api/login')
    .send({ email: 'fotografo@fotecta.com', senha: 'foto123' });

  const res = await agent
    .put('/api/me')
    .send({
      telefone: '(11) 98765-4321',
      cpf: '123.456.789-00',
      metodos_pagamento: ['Pix', 'Cartão de Crédito', 'Boleto Bancário'],
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.user.telefone, '(11) 98765-4321');
  assert.deepEqual(res.body.user.metodos_pagamento, ['Pix', 'Cartão de Crédito', 'Boleto Bancário']);
});

test('POST /api/projetos persiste metodoPagamento e retorna no GET /api/projetos', async () => {
  await ready;
  const clientAgent = request.agent(app);
  await clientAgent
    .post('/api/login')
    .send({ email: 'cliente@fotecta.com', senha: 'cliente123' });

  const createRes = await clientAgent
    .post('/api/projetos')
    .send({
      profissionalId: 3,
      titulo: 'Ensaio Externo',
      descricao: 'Ensaio fotográfico no Jardim Botânico',
      cidade: 'São Paulo',
      estado: 'SP',
      dataEvento: '2026-12-15T10:00',
      valor: 'R$ 1.500',
      metodoPagamento: 'Pix',
    });

  assert.equal(createRes.status, 200);
  assert.equal(createRes.body.ok, true);

  const listRes = await clientAgent.get('/api/projetos');
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.ok, true);
  const createdProj = listRes.body.projetos.find((p) => p.titulo === 'Ensaio Externo');
  assert.ok(createdProj);
  assert.equal(createdProj.metodo_pagamento, 'Pix');
  assert.equal(createdProj.valor, 'R$ 1.500');
});
test('POST /api/projetos/:id/denunciar registra denúncia e admin modera e edita usuário', async () => {
  await ready;
  const clientAgent = request.agent(app);
  await clientAgent
    .post('/api/login')
    .send({ email: 'cliente@fotecta.com', senha: 'cliente123' });

  const projRes = await clientAgent
    .post('/api/projetos')
    .send({
      profissionalId: 3,
      titulo: 'Ensaio Denúncia Teste',
      descricao: 'Descrição teste',
      cidade: 'São Paulo',
      estado: 'SP',
      dataEvento: '2026-12-20T10:00',
    });
  const projId = projRes.body.projeto.id;

  const denRes = await clientAgent
    .post(`/api/projetos/${projId}/denunciar`)
    .send({ motivo: 'Mensagem desrespeitosa durante negociação' });
  assert.equal(denRes.status, 201);
  assert.equal(denRes.body.ok, true);
  const denunciaId = denRes.body.denuncia.id;

  const adminAgent = request.agent(app);
  await adminAgent
    .post('/api/login')
    .send({ email: 'admin@fotecta.com', senha: 'admin123' });

  const listDenRes = await adminAgent.get('/api/admin/denuncias');
  assert.equal(listDenRes.status, 200);
  assert.equal(listDenRes.body.ok, true);
  const foundDen = listDenRes.body.denuncias.find((d) => d.id === denunciaId);
  assert.ok(foundDen);
  assert.equal(foundDen.status, 'pendente');

  const resolveRes = await adminAgent
    .post(`/api/admin/denuncias/${denunciaId}/resolver`)
    .send({ status: 'resolvida' });
  assert.equal(resolveRes.status, 200);
  assert.equal(resolveRes.body.ok, true);

  const editUserRes = await adminAgent
    .put('/api/admin/users/3')
    .send({ nome: 'Lucas Silva Atualizado' });
  assert.equal(editUserRes.status, 200);
  assert.equal(editUserRes.body.ok, true);
});

