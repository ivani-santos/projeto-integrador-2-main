const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const rootDir = __dirname;
const instanceDir = path.join(rootDir, 'instance');
fs.mkdirSync(instanceDir, { recursive: true });

const dbPath = path.join(instanceDir, 'fotecta.sqlite3');
let db = null;
let ready = (async () => {
  const initSqlJs = require('sql.js');
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const fileExists = fs.existsSync(dbPath);
  db = fileExists ? new SQL.Database(new Uint8Array(fs.readFileSync(dbPath))) : new SQL.Database();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      sobrenome TEXT,
      email TEXT UNIQUE,
      senha TEXT,
      tipo TEXT,
      foto TEXT,
      bio TEXT,
      localizacao TEXT,
      interesses TEXT,
      preco TEXT,
      instagram TEXT,
      facebook TEXT,
      favoritos TEXT DEFAULT '[]',
      created_at TEXT,
      whatsapp_clicks INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reset_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      email TEXT UNIQUE,
      nascimento TEXT,
      created_at TEXT
    );
  `);
  persistDb();
  ensureDemoUsers();
})();

function isoNow() {
  return new Date().toISOString();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parseJson(value, fallback = []) {
  try {
    const parsed = JSON.parse(value || 'null');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function persistDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

function buildRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    nome: row.nome || '',
    sobrenome: row.sobrenome || '',
    email: row.email || '',
    senha: row.senha || '',
    tipo: row.tipo || 'cliente',
    foto: row.foto || null,
    bio: row.bio || '',
    localizacao: row.localizacao || '',
    interesses: row.interesses || '',
    preco: row.preco || '',
    instagram: row.instagram || '',
    facebook: row.facebook || '',
    favoritos: parseJson(row.favoritos, []),
    created_at: row.created_at || isoNow(),
    whatsapp_clicks: Number(row.whatsapp_clicks || 0),
    favorited_by_count: 0,
  };
}

function publicUser(user) {
  if (!user) return null;
  const copy = { ...user };
  delete copy.senha;
  delete copy.password_hash;
  return copy;
}

function getUserByEmail(email) {
  const row = queryOne('SELECT * FROM users WHERE email = ?', [normalizeEmail(email)]);
  return buildRow(row);
}

function getUserById(id) {
  if (!id) return null;
  const row = queryOne('SELECT * FROM users WHERE id = ?', [Number(id)]);
  return buildRow(row);
}

function listUsers() {
  const rows = queryAll('SELECT * FROM users ORDER BY created_at DESC');
  const users = rows.map(buildRow);
  users.forEach((user) => {
    user.favorited_by_count = users.filter((other) => Array.isArray(other.favoritos) && other.favoritos.includes(user.email)).length;
  });
  return users.sort((a, b) => (b.favorited_by_count || 0) - (a.favorited_by_count || 0));
}

function currentUser(req) {
  return req.session?.userId ? getUserById(req.session.userId) : null;
}

function requireCurrentUser(req, userId) {
  const user = currentUser(req);
  if (!user) {
    return [null, { status: 401, body: { ok: false, message: 'Não autenticado.' } }];
  }
  if (String(user.id) !== String(userId) && user.tipo !== 'admin') {
    return [null, { status: 403, body: { ok: false, message: 'Não autorizado.' } }];
  }
  return [user, null];
}

function requireAdmin(req) {
  const user = currentUser(req);
  if (!user || user.tipo !== 'admin') {
    return [null, { status: 403, body: { ok: false, message: 'Não autorizado.' } }];
  }
  return [user, null];
}

function ensureDemoUsers() {
  const demoUsers = [
    {
      nome: 'Admin Demo',
      sobrenome: '',
      email: 'admin@fotecta.com',
      senha: 'admin123',
      tipo: 'admin',
      foto: null,
      bio: '',
      localizacao: '',
      interesses: '',
      preco: '',
      instagram: '',
      facebook: '',
      favoritos: [],
    },
    {
      nome: 'Cliente Demo',
      sobrenome: '',
      email: 'cliente@fotecta.com',
      senha: 'cliente123',
      tipo: 'cliente',
      foto: null,
      bio: '',
      localizacao: '',
      interesses: 'Festas, retratos e eventos familiares.',
      preco: '',
      instagram: '',
      facebook: '',
      favoritos: ['fotografo@fotecta.com'],
    },
    {
      nome: 'Fotógrafo Demo',
      sobrenome: '',
      email: 'fotografo@fotecta.com',
      senha: 'foto123',
      tipo: 'fotografo',
      foto: null,
      bio: 'Profissional de demonstração do FOTECTA.',
      localizacao: 'São Paulo, SP',
      interesses: '',
      preco: 'Sob consulta',
      instagram: '@fotodemo',
      facebook: 'https://facebook.com/fotodemo',
      favoritos: [],
    },
  ];

  const count = queryOne('SELECT COUNT(*) AS total FROM users').total;
  if (count > 0) return;

  for (const user of demoUsers) {
    db.run(
      `INSERT INTO users (nome, sobrenome, email, senha, tipo, foto, bio, localizacao, interesses, preco, instagram, facebook, favoritos, created_at, whatsapp_clicks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.nome,
        user.sobrenome,
        normalizeEmail(user.email),
        bcrypt.hashSync(user.senha, 10),
        user.tipo,
        user.foto,
        user.bio,
        user.localizacao,
        user.interesses,
        user.preco,
        user.instagram,
        user.facebook,
        JSON.stringify(user.favoritos || []),
        isoNow(),
        0,
      ],
    );
  }
  persistDb();
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fotecta-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' },
}));
app.use(express.static(path.join(rootDir, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(rootDir, 'public', 'index.html')));
app.get('/homepage', (req, res) => res.sendFile(path.join(rootDir, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(rootDir, 'public', 'login.html')));
app.get('/cadastro', (req, res) => res.sendFile(path.join(rootDir, 'public', 'cadastro.html')));
app.get('/sobrenos', (req, res) => res.sendFile(path.join(rootDir, 'public', 'sobrenos.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(rootDir, 'public', 'admin.html')));
app.get('/clientelogado', (req, res) => res.sendFile(path.join(rootDir, 'public', 'clientelogado.html')));
app.get('/fotografologado', (req, res) => res.sendFile(path.join(rootDir, 'public', 'fotografologado.html')));
app.get('/busca', (req, res) => res.sendFile(path.join(rootDir, 'public', 'busca.html')));
app.get('/signup-client', (req, res) => res.sendFile(path.join(rootDir, 'public', 'signup_client.html')));
app.get('/signup_client', (req, res) => res.sendFile(path.join(rootDir, 'public', 'signup_client.html')));
app.get('/signup-fotografo', (req, res) => res.sendFile(path.join(rootDir, 'public', 'signup_fotografo.html')));
app.get('/signup_fotografo', (req, res) => res.sendFile(path.join(rootDir, 'public', 'signup_fotografo.html')));
app.get('/perfil-publico', (req, res) => res.sendFile(path.join(rootDir, 'public', 'perfil_publico.html')));
app.get('/perfil_publico', (req, res) => res.sendFile(path.join(rootDir, 'public', 'perfil_publico.html')));
app.get('/perfil-cliente', (req, res) => res.sendFile(path.join(rootDir, 'public', 'perfil_cliente.html')));
app.get('/perfil_cliente', (req, res) => res.sendFile(path.join(rootDir, 'public', 'perfil_cliente.html')));
app.get('/perfil-prof', (req, res) => res.sendFile(path.join(rootDir, 'public', 'perfil_prof.html')));
app.get('/perfil_prof', (req, res) => res.sendFile(path.join(rootDir, 'public', 'perfil_prof.html')));
app.get('/editar-perfil', (req, res) => res.sendFile(path.join(rootDir, 'public', 'editar_perfil.html')));
app.get('/editar_perfil', (req, res) => res.sendFile(path.join(rootDir, 'public', 'editar_perfil.html')));

app.get('/api/me', (req, res) => {
  const user = currentUser(req);
  res.json({ ok: !!user, user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const senha = String(body.senha || '');

  if (!email || !senha) {
    return res.status(400).json({ ok: false, message: 'E-mail e senha obrigatórios.' });
  }

  const user = getUserByEmail(email);
  if (!user || !bcrypt.compareSync(senha, user.senha)) {
    return res.status(401).json({ ok: false, message: 'Credenciais inválidas.' });
  }

  req.session.userId = user.id;
  return res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/register', (req, res) => {
  const payload = req.body || {};
  const nome = String(payload.nome || '').trim();
  const email = normalizeEmail(payload.email);
  const senha = String(payload.senha || '');
  const tipo = String(payload.tipo || 'cliente').trim().toLowerCase();

  if (!nome || !email || !senha) {
    return res.status(400).json({ ok: false, message: 'Nome, e-mail e senha são obrigatórios.' });
  }

  if (getUserByEmail(email)) {
    return res.status(400).json({ ok: false, message: 'E-mail já cadastrado.' });
  }

  db.run(
    `INSERT INTO users (nome, sobrenome, email, senha, tipo, foto, bio, localizacao, interesses, preco, instagram, facebook, favoritos, created_at, whatsapp_clicks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nome,
      '',
      email,
      bcrypt.hashSync(senha, 10),
      ['admin', 'cliente', 'fotografo'].includes(tipo) ? tipo : 'cliente',
      null,
      '',
      '',
      '',
      '',
      '',
      '',
      JSON.stringify([]),
      isoNow(),
      0,
    ],
  );

  const lastId = queryOne('SELECT last_insert_rowid() AS id').id;
  const user = getUserById(lastId);
  req.session.userId = user.id;
  persistDb();
  return res.status(201).json({ ok: true, user: publicUser(user) });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.post('/api/password-reset', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ ok: false, message: 'E-mail obrigatório.' });

  const user = getUserByEmail(email);
  if (!user) return res.status(404).json({ ok: false, message: 'E-mail não encontrado.' });

  const existing = queryOne('SELECT id FROM reset_requests WHERE email = ?', [email]);
  if (existing) {
    db.run('UPDATE reset_requests SET nome = ?, nascimento = ?, created_at = ? WHERE email = ?', [user.nome, String(req.body?.nascimento || ''), isoNow(), email]);
  } else {
    db.run('INSERT INTO reset_requests (nome, email, nascimento, created_at) VALUES (?, ?, ?, ?)', [user.nome, email, String(req.body?.nascimento || ''), isoNow()]);
  }
  persistDb();

  return res.json({ ok: true, message: 'E-mail de recuperação enviado (simulado).' });
});

app.get('/api/users', (req, res) => {
  const users = listUsers().map((user) => publicUser(user));
  res.json({ ok: true, users });
});

app.get('/api/users/:id', (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ ok: false, message: 'Usuário não encontrado.' });
  res.json({ ok: true, user: publicUser(user) });
});

app.put('/api/users/:id', (req, res) => {
  const [user, error] = requireCurrentUser(req, req.params.id);
  if (error) {
    const { status, body } = error;
    return res.status(status).json(body);
  }

  const payload = req.body || {};
  db.run(
    `UPDATE users
     SET nome = ?, sobrenome = ?, email = ?, bio = ?, localizacao = ?, interesses = ?, preco = ?, instagram = ?, facebook = ?
     WHERE id = ?`,
    [
      String(payload.nome || user.nome),
      String(payload.sobrenome || user.sobrenome),
      normalizeEmail(payload.email || user.email),
      String(payload.bio || user.bio),
      String(payload.localizacao || user.localizacao),
      String(payload.interesses || user.interesses),
      String(payload.preco || user.preco),
      String(payload.instagram || user.instagram),
      String(payload.facebook || user.facebook),
      Number(req.params.id),
    ],
  );
  persistDb();

  const updated = getUserById(req.params.id);
  res.json({ ok: true, user: publicUser(updated) });
});

app.delete('/api/users/:id', (req, res) => {
  const [user, error] = requireCurrentUser(req, req.params.id);
  if (error) {
    const { status, body } = error;
    return res.status(status).json(body);
  }

  db.run('DELETE FROM users WHERE id = ?', [Number(req.params.id)]);
  persistDb();
  if (Number(req.session.userId) === Number(req.params.id)) {
    req.session.destroy(() => {});
  }

  return res.json({ ok: true, message: 'Usuário removido.' });
});

app.get('/api/users/:id/favoritos', (req, res) => {
  const [user, error] = requireCurrentUser(req, req.params.id);
  if (error) {
    const { status, body } = error;
    return res.status(status).json(body);
  }
  const current = getUserById(req.params.id);
  res.json({ ok: true, favoritos: current?.favoritos || [] });
});

app.post('/api/users/:id/favoritos', (req, res) => {
  const [user, error] = requireCurrentUser(req, req.params.id);
  if (error) {
    const { status, body } = error;
    return res.status(status).json(body);
  }

  if (user.tipo !== 'cliente') {
    return res.status(403).json({ ok: false, message: 'Apenas clientes podem favoritar profissionais.' });
  }

  const favoritos = Array.isArray(req.body?.favoritos) ? req.body.favoritos.map((item) => normalizeEmail(item)) : [];
  const unique = [...new Set(favoritos.filter(Boolean))];
  db.run('UPDATE users SET favoritos = ? WHERE id = ?', [JSON.stringify(unique), Number(req.params.id)]);
  persistDb();
  res.json({ ok: true, favoritos: unique });
});

app.get('/api/reset-requests', (req, res) => {
  const [user, error] = requireAdmin(req);
  if (error) {
    const { status, body } = error;
    return res.status(status).json(body);
  }

  const rows = queryAll('SELECT * FROM reset_requests ORDER BY created_at DESC');
  return res.json({ ok: true, requests: rows });
});

app.post('/api/reset-requests/:email/approve', (req, res) => {
  const [user, error] = requireAdmin(req);
  if (error) {
    const { status, body } = error;
    return res.status(status).json(body);
  }

  const email = normalizeEmail(decodeURIComponent(req.params.email));
  const exists = queryOne('SELECT id FROM reset_requests WHERE email = ?', [email]);
  if (!exists) {
    return res.status(404).json({ ok: false, message: 'Solicitação não encontrada.' });
  }

  db.run('DELETE FROM reset_requests WHERE email = ?', [email]);
  persistDb();
  return res.json({ ok: true, message: 'Solicitação aprovada.' });
});

app.post('/api/reset-requests/:email/reject', (req, res) => {
  const [user, error] = requireAdmin(req);
  if (error) {
    const { status, body } = error;
    return res.status(status).json(body);
  }

  const email = normalizeEmail(decodeURIComponent(req.params.email));
  const exists = queryOne('SELECT id FROM reset_requests WHERE email = ?', [email]);
  if (!exists) {
    return res.status(404).json({ ok: false, message: 'Solicitação não encontrada.' });
  }

  db.run('DELETE FROM reset_requests WHERE email = ?', [email]);
  persistDb();
  return res.json({ ok: true, message: 'Solicitação rejeitada.' });
});

app.post('/api/users/:id/click-whatsapp', (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ ok: false, message: 'Usuário não encontrado.' });

  const count = Number(user.whatsapp_clicks || 0) + 1;
  db.run('UPDATE users SET whatsapp_clicks = ? WHERE id = ?', [count, Number(req.params.id)]);
  persistDb();
  return res.json({ ok: true, message: 'Clique registrado.', count });
});

app.post('/api/admin/reset-seed', (req, res) => {
  const [user, error] = requireAdmin(req);
  if (error) {
    const { status, body } = error;
    return res.status(status).json(body);
  }

  db.run('DELETE FROM users');
  db.run('DELETE FROM reset_requests');
  persistDb();
  ensureDemoUsers();
  return res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ ok: false, message: 'Erro interno do servidor.' });
});

if (require.main === module) {
  ready.then(() => {
    app.listen(port, () => {
      console.log(`FOTECTA JavaScript rodando em http://localhost:${port}`);
    });
  });
}

module.exports = { app, ready, db };
