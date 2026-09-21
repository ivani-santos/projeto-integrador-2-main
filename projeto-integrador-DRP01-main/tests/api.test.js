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
