/**
 * ============================================================================
 * FOTECTA - Plataforma Web para Contratação de Fotógrafos Autônomos
 * Projeto Integrador II - UNIVESP (Turma de TI - 2026 / Grupo 9)
 *
 * ARQUITETURA GERAL DO BACKEND:
 * - Runtime: Node.js com Express.js
 * - Banco de Dados Híbrido (Dual-Engine):
 *   1. Neon DBaaS (PostgreSQL em Nuvem) via DATABASE_URL com SSL
 *   2. SQLite local em memória (sql.js) como Fallback transparente para testes/desenvolvimento
 * - Mídia & Portfólio: Cloudinary (Nuvem) com Fallback para disco local (uploads/)
 * - Autenticação: Express-Session com Cookies seguros e Bcryptjs para hashing
 * - Acessibilidade e Segurança: WCAG 2.1 / e-MAG, Rate Limiter e Security Headers
 * ============================================================================
 */

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { formidable } = require('formidable');
const cloudinary = require('cloudinary').v2;

const app = express();
const port = process.env.PORT || 3000;
const rootDir = __dirname;
const instanceDir = path.join(rootDir, 'instance');
const uploadDir = path.join(rootDir, 'public', 'uploads');
fs.mkdirSync(instanceDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

// ----------------------------------------------------------------------------
// 1. CONFIGURAÇÃO DE MÍDIA (Cloudinary com fallback local)
// ----------------------------------------------------------------------------
const hasCloudinary = Boolean(process.env.CLOUDINARY_URL);
if (hasCloudinary) cloudinary.config();

// ----------------------------------------------------------------------------
// 2. CAMADA DE BANCO DE DADOS (PostgreSQL Neon DBaaS ou SQLite sql.js)
// ----------------------------------------------------------------------------
const isPostgres = Boolean(process.env.DATABASE_URL);
let pgPool = null;
let db = null;
const dbPath = path.join(instanceDir, 'fotecta.sqlite3');

if (isPostgres) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
}

function toPgSql(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

async function queryAll(sql, params = []) {
  if (isPostgres) {
    const res = await pgPool.query(toPgSql(sql), params);
    return res.rows;
  }
  if (!db) return [];
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows[0] || null;
}

function queryOneSync(sql, params = []) {
  if (!db) return null;
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows[0] || null;
}

async function dbRun(sql, params = []) {
  if (isPostgres) {
    return await pgPool.query(toPgSql(sql), params);
  }
  if (db) {
    db.run(sql, params);
    persistDb();
  }
}

function persistDb() {
  if (isPostgres || !db) return;
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {
    console.error('Erro ao salvar SQLite:', err);
  }
}

// ----------------------------------------------------------------------------
// 3. INICIALIZAÇÃO DE SCHEMAS (MER) E DADOS INICIAIS (SEED)
// ----------------------------------------------------------------------------
const isoNow = () => new Date().toISOString();
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

function parseJson(val, fallback) {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch (_) { return fallback; }
}

function buildRow(row) {
  if (!row) return null;
  const bio = row.bio || '';
  return {
    id: Number(row.id),
    nome: row.nome || '',
    sobrenome: row.sobrenome || '',
    email: row.email || '',
    senha: row.senha || '',
    tipo: row.tipo || 'cliente',
    cpf: row.cpf || '',
    telefone: row.telefone || '',
    foto: row.foto || null,
    bio,
    biografia: bio,
    localizacao: row.localizacao || '',
    cidade: row.cidade || '',
    estado: row.estado || '',
    cep: row.cep || '',
    latitude: row.latitude != null ? Number(row.latitude) : -23.5505,
    longitude: row.longitude != null ? Number(row.longitude) : -46.6333,
    interesses: row.interesses || '',
    preco: row.preco || '',
    instagram: row.instagram || '',
    facebook: row.facebook || '',
    especialidades: parseJson(row.especialidades, ['Casamentos', 'Eventos']),
    metodos_pagamento: parseJson(row.metodos_pagamento, ['Pix', 'Cartão de Crédito', 'Dinheiro']),
    favoritos: parseJson(row.favoritos, []),
    created_at: row.created_at || isoNow(),
    whatsapp_clicks: Number(row.whatsapp_clicks || 0),
  };
}

function publicUser(user) {
  if (!user) return null;
  const copy = { ...user };
  delete copy.senha;
  delete copy.cpf; // Preserva a privacidade do CPF em dados públicos
  return copy;
}

async function getUserById(id) {
  return buildRow(await queryOne('SELECT * FROM users WHERE id = ?', [Number(id)]));
}
function getUserByIdSync(id) {
  return buildRow(queryOneSync('SELECT * FROM users WHERE id = ?', [Number(id)]));
}
async function getUserByEmail(email) {
  return buildRow(await queryOne('SELECT * FROM users WHERE email = ?', [normalizeEmail(email)]));
}

// Inicialização Assíncrona do Banco
const ready = (async () => {
  const pk = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const schemas = [
    `CREATE TABLE IF NOT EXISTS users (
      id ${pk}, nome TEXT, sobrenome TEXT, email TEXT UNIQUE, senha TEXT, tipo TEXT,
      cpf TEXT DEFAULT '', telefone TEXT DEFAULT '', foto TEXT, bio TEXT, localizacao TEXT,
      cidade TEXT DEFAULT '', estado TEXT DEFAULT '', cep TEXT DEFAULT '',
      latitude REAL DEFAULT -23.5505, longitude REAL DEFAULT -46.6333,
      interesses TEXT, preco TEXT, instagram TEXT, facebook TEXT,
      especialidades TEXT DEFAULT '[]', metodos_pagamento TEXT DEFAULT '[]',
      favoritos TEXT DEFAULT '[]', created_at TEXT, whatsapp_clicks INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS portfolio (
      id ${pk}, user_id INTEGER, nome TEXT, categoria TEXT, legenda TEXT, url TEXT, created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS projetos (
      id ${pk}, profissional_id INTEGER, cliente_id INTEGER, cliente_nome TEXT,
      titulo TEXT, descricao TEXT, cidade TEXT, estado TEXT, data_evento TEXT,
      valor TEXT DEFAULT '', metodo_pagamento TEXT DEFAULT '', status TEXT DEFAULT 'aberto', created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS avaliacoes (
      id ${pk}, profissional_id INTEGER, cliente_id INTEGER, cliente_nome TEXT,
      nota INTEGER, comentario TEXT, resposta TEXT, data_resposta TEXT, created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS mensagens (
      id ${pk}, projeto_id INTEGER, remetente_id INTEGER, remetente_nome TEXT, texto TEXT, created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS reset_requests (
      id ${pk}, email TEXT, data_nascimento TEXT, status TEXT DEFAULT 'pendente', created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS denuncias (
      id ${pk}, projeto_id INTEGER, denunciante_id INTEGER, denunciante_nome TEXT,
      denunciado_id INTEGER, denunciado_nome TEXT, motivo TEXT, detalhes TEXT DEFAULT '',
      status TEXT DEFAULT 'pendente', created_at TEXT
    )`
  ];

  if (isPostgres) {
    for (const sql of schemas) await pgPool.query(sql);
  } else {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    if (fs.existsSync(dbPath)) {
      db = new SQL.Database(fs.readFileSync(dbPath));
    } else {
      db = new SQL.Database();
    }
    for (const sql of schemas) db.run(sql);
    persistDb();
  }

  await ensureDemoUsers();
})();

async function ensureDemoUsers() {
  const countRow = await queryOne('SELECT COUNT(*) AS total FROM users');
  if (Number(countRow?.total || 0) > 0) return;

  const demoUsers = [
    { nome: 'Administrador', sobrenome: '', email: 'admin@fotecta.com', senha: 'admin123', tipo: 'admin', localizacao: 'São Paulo, SP' },
    { nome: 'Cliente Demo', sobrenome: '', email: 'cliente@fotecta.com', senha: 'cliente123', tipo: 'cliente', cpf: '987.654.321-11', telefone: '(11) 91234-5678', localizacao: 'São Paulo, SP', cidade: 'São Paulo', estado: 'SP', cep: '04571-010', interesses: 'Festas e retratos.', favoritos: ['fotografo@fotecta.com'] },
    { nome: 'Ana Oliveira', sobrenome: '', email: 'fotografo@fotecta.com', senha: 'foto123', tipo: 'fotografo', cpf: '123.456.789-00', telefone: '(11) 98765-4321', foto: '/uploads/foto1.svg', bio: 'Especializada em casamentos e ensaios com iluminação natural.', localizacao: 'São Paulo, SP', cidade: 'São Paulo', estado: 'SP', cep: '01310-100', preco: 'A partir de R$ 900', instagram: '@anaoliveirafoto', especialidades: ['Casamentos', 'Ensaios', 'Eventos'], metodos_pagamento: ['Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro'] },
    { nome: 'Carlos Mendes', sobrenome: '', email: 'carlos@fotecta.com', senha: 'foto123', tipo: 'fotografo', cpf: '234.567.890-11', telefone: '(19) 99876-5432', foto: '/uploads/foto2.svg', bio: 'Fotógrafo publicitário e eventos corporativos.', localizacao: 'Campinas, SP', cidade: 'Campinas', estado: 'SP', cep: '13010-000', latitude: -22.9056, longitude: -47.0608, preco: 'R$ 1.200 - R$ 2.500', instagram: '@carlosmendes.photo', especialidades: ['Publicidade', 'Eventos'], metodos_pagamento: ['Pix', 'Cartão de Crédito', 'Boleto Bancário'] },
    { nome: 'Gabriela Sampaio', sobrenome: '', email: 'gabriela@fotecta.com', senha: 'foto123', tipo: 'fotografo', cpf: '345.678.901-22', telefone: '(11) 97654-3210', foto: '/uploads/foto1.svg', bio: 'Retratos femininos e ensaios criativos.', localizacao: 'São Paulo, SP', cidade: 'São Paulo', estado: 'SP', cep: '01310-100', preco: 'R$ 700 - R$ 1.400', instagram: '@gabriela.retratos', especialidades: ['Ensaios', 'Eventos'], metodos_pagamento: ['Pix', 'Cartão de Crédito'] },
    { nome: 'Leonardo Silva', sobrenome: '', email: 'leonardo@fotecta.com', senha: 'foto123', tipo: 'fotografo', cpf: '456.789.012-33', telefone: '(13) 98123-4567', foto: '/uploads/foto2.svg', bio: 'Fotografia documental e ensaios de casal.', localizacao: 'Santos, SP', cidade: 'Santos', estado: 'SP', cep: '11010-000', latitude: -23.9618, longitude: -46.3108, preco: 'R$ 800 - R$ 1.800', instagram: '@leosilvafotografia', especialidades: ['Casamentos', 'Eventos'], metodos_pagamento: ['Pix', 'Dinheiro', 'Cartão de Débito'] }
  ];

  for (const u of demoUsers) {
    const hashed = await bcrypt.hash(u.senha, 10);
    await dbRun(
      `INSERT INTO users (nome, sobrenome, email, senha, tipo, cpf, telefone, foto, bio, localizacao, cidade, estado, cep, latitude, longitude, interesses, preco, instagram, facebook, especialidades, metodos_pagamento, favoritos, created_at, whatsapp_clicks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        u.nome, u.sobrenome || '', normalizeEmail(u.email), hashed, u.tipo, u.cpf || '', u.telefone || '',
        u.foto || null, u.bio || '', u.localizacao || '', u.cidade || '', u.estado || '', u.cep || '',
        u.latitude || -23.5505, u.longitude || -46.6333, u.interesses || '', u.preco || '',
        u.instagram || '', u.facebook || '', JSON.stringify(u.especialidades || []),
        JSON.stringify(u.metodos_pagamento || []), JSON.stringify(u.favoritos || []), isoNow(), 0
      ]
    );
  }

  const demoPhotographer = await getUserByEmail('fotografo@fotecta.com');
  if (demoPhotographer) {
    const photos = [
      { nome: 'Ensaio Casamento', categoria: 'Casamentos', legenda: 'Cerimônia ao entardecer no campo', url: '/uploads/foto1.svg' },
      { nome: 'Ensaio Urbano', categoria: 'Ensaios', legenda: 'Retrato urbano na Avenida Paulista', url: '/uploads/foto2.svg' }
    ];
    for (const p of photos) {
      await dbRun('INSERT INTO portfolio (user_id, nome, categoria, legenda, url, created_at) VALUES (?, ?, ?, ?, ?, ?)', [demoPhotographer.id, p.nome, p.categoria, p.legenda, p.url, isoNow()]);
    }

    await dbRun(
      `INSERT INTO projetos (profissional_id, cliente_id, cliente_nome, titulo, descricao, cidade, estado, data_evento, valor, metodo_pagamento, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aberto', ?)`,
      [demoPhotographer.id, 2, 'Cliente Demo', 'Ensaio familiar no parque', 'Orçamento para fotos em luz natural.', 'São Paulo', 'SP', '2026-11-20T15:00', 'R$ 950', 'Pix', isoNow()]
    );

    await dbRun(
      `INSERT INTO avaliacoes (profissional_id, cliente_id, cliente_nome, nota, comentario, resposta, data_resposta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [demoPhotographer.id, 2, 'Mariana Souza', 5, 'Excelente atendimento, fotos com luz incrível!', 'Muito obrigada, Mariana!', isoNow(), isoNow()]
    );

    await dbRun(
      'INSERT INTO mensagens (projeto_id, remetente_id, remetente_nome, texto, created_at) VALUES (?, ?, ?, ?, ?)',
      [1, 2, 'Cliente Demo', 'Olá Ana, tudo bem? Tem disponibilidade para ensaio dia 20?', isoNow()]
    );
  }
}

// ----------------------------------------------------------------------------
// 4. MIDDLEWARES (Segurança, Sessão e RBAC)
// ----------------------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.removeHeader('X-Powered-By');
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'fotecta_sid',
  secret: process.env.SESSION_SECRET || 'fotecta-academico-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 3600 * 1000 }
}));

function currentUser(req) {
  if (req.session?.user) return req.session.user;
  if (!isPostgres && req.session?.userId) return getUserByIdSync(req.session.userId);
  return null;
}

async function requireAuth(req, res, next) {
  let user = null;
  if (req.session?.userId) {
    user = await getUserById(req.session.userId);
  } else if (req.session?.user?.id) {
    user = await getUserById(req.session.user.id);
  }
  if (!user) return res.status(401).json({ ok: false, message: 'Autenticação necessária.' });
  req.user = user;
  next();
}

function requireRole(...roles) {
  return async (req, res, next) => {
    let user = null;
    if (req.session?.userId) {
      user = await getUserById(req.session.userId);
    } else if (req.session?.user?.id) {
      user = await getUserById(req.session.user.id);
    }
    if (!user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
    if (!roles.includes(user.tipo) && user.tipo !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Acesso negado para o seu perfil.' });
    }
    req.user = user;
    next();
  };
}
const requireAdmin = requireRole('admin');
const requireFotografo = requireRole('fotografo');

// Rate Limiter simples em memória
function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const key = req.ip || 'ip';
    const now = Date.now();
    const record = hits.get(key) || { count: 0, startTime: now };
    if (now - record.startTime > windowMs) {
      record.count = 1;
      record.startTime = now;
    } else {
      record.count++;
    }
    hits.set(key, record);
    if (record.count > max) {
      return res.status(429).json({ ok: false, message: 'Muitas requisições. Aguarde antes de tentar novamente.' });
    }
    next();
  };
}
const authLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20 });

// Helper para Uploads Multipart
async function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 8 * 1024 * 1024,
      filter: ({ mimetype }) => Boolean(mimetype && mimetype.startsWith('image/')),
    });
    form.parse(req, async (err, fields, files) => {
      if (err) return reject(new Error('Erro ao processar imagem enviada.'));
      const parsedFields = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
      const parsedFiles = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));

      if (hasCloudinary) {
        for (const file of Object.values(parsedFiles)) {
          if (file?.filepath) {
            try {
              const uploadRes = await cloudinary.uploader.upload(file.filepath, { folder: 'fotecta' });
              file.fileUrl = uploadRes.secure_url;
              try { fs.unlinkSync(file.filepath); } catch (_) {}
            } catch (cloudErr) {
              console.warn('Fallback para armazenamento local:', cloudErr.message);
            }
          }
        }
      }
      resolve({ fields: parsedFields, files: parsedFiles });
    });
  });
}

async function removeUploadFileIfExists(fileUrl) {
  if (!fileUrl) return;
  if (hasCloudinary && fileUrl.includes('cloudinary.com')) {
    try {
      const match = fileUrl.match(/\/fotecta\/([^./]+)/);
      if (match) await cloudinary.uploader.destroy(`fotecta/${match[1]}`);
      return;
    } catch (_) {}
  }
  const filename = path.basename(fileUrl);
  const localPath = path.join(uploadDir, filename);
  if (fs.existsSync(localPath)) {
    try { fs.unlinkSync(localPath); } catch (_) {}
  }
}

// Cálculo de Distância Geodésica (Fórmula de Haversine em km)
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

async function getRatingForUser(userId) {
  const rows = await queryAll('SELECT nota FROM avaliacoes WHERE profissional_id = ?', [Number(userId)]);
  if (!rows.length) return { media: 5.0, total: 0 };
  const sum = rows.reduce((acc, curr) => acc + Number(curr.nota || 0), 0);
  return { media: Number((sum / rows.length).toFixed(1)), total: rows.length };
}

// ----------------------------------------------------------------------------
// 5. ROTAS DE PÁGINAS E ESTÁTICOS
// ----------------------------------------------------------------------------
app.get(['/', '/homepage', '/login', '/cadastro', '/busca', '/clientelogado', '/fotografologado'], (req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'index.html'));
});
app.get(['/sobrenos', '/sobrenos.html'], (req, res) => res.redirect('/#sobrenos'));

app.get('/admin', (req, res) => {
  const user = currentUser(req);
  if (!user || user.tipo !== 'admin') return res.redirect('/#login');
  res.sendFile(path.join(rootDir, 'public', 'admin.html'));
});

app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/x-icon');
  res.sendFile(path.join(rootDir, 'public', 'favicon.ico'));
});
app.get('/favicon.svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.sendFile(path.join(rootDir, 'public', 'favicon.svg'));
});
app.get(['/favicon-32x32.png', '/favicon-16x16.png', '/apple-touch-icon.png'], (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.sendFile(path.join(rootDir, 'public', path.basename(req.path)));
});

app.use(express.static(path.join(rootDir, 'public')));

// ----------------------------------------------------------------------------
// 6. ROTAS DE AUTENTICAÇÃO E SESSÃO
// ----------------------------------------------------------------------------
app.get('/api/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.json({ ok: false, user: null });
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/login', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const senha = String(req.body?.senha || '');
  const user = await getUserByEmail(email);

  if (!user || !(await bcrypt.compare(senha, user.senha))) {
    return res.status(401).json({ ok: false, message: 'E-mail ou senha incorretos.' });
  }

  req.session.userId = user.id;
  req.session.user = publicUser(user);
  res.json({ ok: true, message: 'Autenticado com sucesso.', user: publicUser(user) });
});

app.post(['/api/register', '/api/cadastro'], authLimiter, async (req, res) => {
  const b = req.body || {};
  const nome = String(b.nome || '').trim();
  const email = normalizeEmail(b.email);
  const senha = String(b.senha || '');
  const tipo = ['admin', 'cliente', 'fotografo'].includes(b.tipo) ? b.tipo : 'cliente';

  if (!nome || !email || senha.length < 8) {
    return res.status(400).json({ ok: false, message: 'Dados inválidos. A senha deve ter ao menos 8 caracteres.' });
  }
  if (await getUserByEmail(email)) {
    return res.status(400).json({ ok: false, message: 'E-mail já cadastrado.' });
  }

  const hashed = await bcrypt.hash(senha, 10);
  const metodos = tipo === 'fotografo' ? ['Pix', 'Cartão de Crédito', 'Dinheiro'] : [];
  await dbRun(
    `INSERT INTO users (nome, sobrenome, email, senha, tipo, cpf, telefone, localizacao, cidade, metodos_pagamento, favoritos, created_at)
     VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)`,
    [nome, email, hashed, tipo, String(b.cpf || '').trim(), String(b.telefone || '').trim(), String(b.cidade || '').trim(), String(b.cidade || '').trim(), JSON.stringify(metodos), isoNow()]
  );

  const created = await getUserByEmail(email);
  req.session.userId = created.id;
  req.session.user = publicUser(created);
  res.status(201).json({ ok: true, message: 'Cadastro realizado com sucesso!', user: publicUser(created) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true, message: 'Sessão encerrada.' }));
});

app.put('/api/me', requireAuth, async (req, res) => {
  const user = req.user;
  const b = req.body || {};
  const nome = String(b.nome || user.nome).trim();
  const cpf = b.cpf !== undefined ? String(b.cpf).trim() : (user.cpf || '');
  const telefone = b.telefone !== undefined ? String(b.telefone).trim() : (user.telefone || '');
  const localizacao = String(b.localizacao ?? user.localizacao ?? '');
  const cidade = b.cidade !== undefined ? String(b.cidade).trim() : (user.cidade || '');
  const bio = String(b.bio ?? user.bio ?? '');
  const interesses = String(b.interesses ?? user.interesses ?? '');

  let metodos = user.metodos_pagamento || [];
  if (b.metodos_pagamento !== undefined || b.metodosPagamento !== undefined) {
    const raw = b.metodos_pagamento ?? b.metodosPagamento;
    metodos = Array.isArray(raw) ? raw : parseJson(raw, user.metodos_pagamento || []);
  }

  await dbRun(
    'UPDATE users SET nome = ?, cpf = ?, telefone = ?, localizacao = ?, cidade = ?, bio = ?, interesses = ?, metodos_pagamento = ? WHERE id = ?',
    [nome, cpf, telefone, localizacao, cidade, bio, interesses, JSON.stringify(metodos), user.id]
  );

  const updated = await getUserById(user.id);
  req.session.user = publicUser(updated);
  res.json({ ok: true, message: 'Dados atualizados com sucesso.', user: publicUser(updated) });
});

app.delete('/api/me/foto', requireAuth, async (req, res) => {
  const user = req.user;
  await removeUploadFileIfExists(user.foto);
  await dbRun('UPDATE users SET foto = NULL WHERE id = ?', [user.id]);
  const updated = await getUserById(user.id);
  req.session.user = publicUser(updated);
  res.json({ ok: true, message: 'Foto removida.', foto: null, user: publicUser(updated) });
});

// ----------------------------------------------------------------------------
// 7. ROTAS PÚBLICAS E VITRINE DE PROFISSIONAIS
// ----------------------------------------------------------------------------
app.get('/api/profissionais', async (req, res) => {
  const rows = await queryAll("SELECT * FROM users WHERE tipo = 'fotografo'");
  const userLat = req.query.lat ? Number(req.query.lat) : null;
  const userLng = req.query.lng ? Number(req.query.lng) : null;

  const profissionais = await Promise.all(
    rows.map(async (row) => {
      const u = buildRow(row);
      const rating = await getRatingForUser(u.id);
      let dist = null;
      if (userLat != null && userLng != null && !isNaN(userLat) && !isNaN(userLng)) {
        dist = haversineKm(userLat, userLng, u.latitude, u.longitude);
      }
      return {
        ...publicUser(u),
        media_nota: rating.media,
        total_avaliacoes: rating.total,
        distancia_km: dist,
      };
    })
  );

  if (userLat != null && userLng != null) {
    profissionais.sort((a, b) => (a.distancia_km ?? 9999) - (b.distancia_km ?? 9999));
  }
  res.json({ ok: true, profissionais });
});

app.get('/api/profissionais/:id', async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user || user.tipo !== 'fotografo') {
    return res.status(404).json({ ok: false, message: 'Profissional não encontrado.' });
  }

  const portfolio = await queryAll('SELECT id, nome, categoria, legenda, url FROM portfolio WHERE user_id = ? ORDER BY id DESC', [user.id]);
  const avaliacoes = await queryAll('SELECT id, cliente_nome, nota, comentario, resposta, data_resposta, created_at FROM avaliacoes WHERE profissional_id = ? ORDER BY id DESC', [user.id]);
  const rating = await getRatingForUser(user.id);

  res.json({
    ok: true,
    profissional: {
      ...publicUser(user),
      portfolio,
      avaliacoes,
      media_nota: rating.media,
      total_avaliacoes: rating.total,
    },
  });
});

app.post('/api/profissionais/:id/avaliar', requireAuth, async (req, res) => {
  const user = req.user;
  const profId = Number(req.params.id);
  if (user.id === profId) {
    return res.status(400).json({ ok: false, message: 'Você não pode avaliar o seu próprio perfil.' });
  }

  const nota = Math.min(5, Math.max(1, Number(req.body?.nota || 5)));
  const comentario = String(req.body?.comentario || '').trim();
  if (!comentario) return res.status(400).json({ ok: false, message: 'Comentário obrigatório.' });

  await dbRun(
    'INSERT INTO avaliacoes (profissional_id, cliente_id, cliente_nome, nota, comentario, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [profId, user.id, user.nome, nota, comentario, isoNow()]
  );
  res.json({ ok: true, message: 'Avaliação enviada com sucesso!' });
});

app.post('/api/avaliacoes/:id/responder', requireFotografo, async (req, res) => {
  const id = Number(req.params.id);
  const resposta = String(req.body?.resposta || '').trim();
  const aval = await queryOne('SELECT * FROM avaliacoes WHERE id = ?', [id]);
  if (!aval || Number(aval.profissional_id) !== req.user.id) {
    return res.status(403).json({ ok: false, message: 'Não autorizado.' });
  }
  await dbRun('UPDATE avaliacoes SET resposta = ?, data_resposta = ? WHERE id = ?', [resposta, isoNow(), id]);
  res.json({ ok: true, message: 'Resposta registrada.' });
});

// ----------------------------------------------------------------------------
// 8. ROTAS DE PAINEL DO FOTÓGRAFO (Perfil e Portfólio)
// ----------------------------------------------------------------------------
app.put('/api/fotografo/perfil', requireFotografo, async (req, res) => {
  try {
    const { fields, files } = await parseForm(req);
    const user = req.user;
    let fotoUrl = user.foto;

    if (files.fotoPerfil) {
      await removeUploadFileIfExists(user.foto);
      fotoUrl = files.fotoPerfil.fileUrl || `/uploads/${files.fotoPerfil.newFilename}`;
    }

    const bio = String(fields.biografia || user.bio);
    const loc = String(fields.localizacao || user.localizacao);
    const preco = String(fields.preco || user.preco);
    const insta = String(fields.instagram || user.instagram);
    const tel = fields.telefone !== undefined ? String(fields.telefone).trim() : user.telefone;
    const cpf = fields.cpf !== undefined ? String(fields.cpf).trim() : user.cpf;

    let metodos = user.metodos_pagamento;
    if (fields.metodosPagamento) {
      metodos = parseJson(fields.metodosPagamento, [fields.metodosPagamento]);
    }

    await dbRun(
      'UPDATE users SET bio = ?, localizacao = ?, preco = ?, instagram = ?, foto = ?, telefone = ?, cpf = ?, metodos_pagamento = ? WHERE id = ?',
      [bio, loc, preco, insta, fotoUrl, tel, cpf, JSON.stringify(metodos), user.id]
    );

    res.json({ ok: true, message: 'Perfil salvo com sucesso!' });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

app.get('/api/fotografo/portfolio', requireFotografo, async (req, res) => {
  const portfolio = await queryAll('SELECT * FROM portfolio WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
  res.json({ ok: true, portfolio });
});

app.post('/api/fotografo/portfolio', requireFotografo, async (req, res) => {
  try {
    const { fields, files } = await parseForm(req);
    if (!files.foto) return res.status(400).json({ ok: false, message: 'Imagem obrigatória.' });

    const url = files.foto.fileUrl || `/uploads/${files.foto.newFilename}`;
    await dbRun(
      'INSERT INTO portfolio (user_id, nome, categoria, legenda, url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, String(fields.nomePortfolio || 'Coleção'), String(fields.categoria || 'Outros'), String(fields.legenda || ''), url, isoNow()]
    );
    res.json({ ok: true, message: 'Foto adicionada!' });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

app.put('/api/fotografo/portfolio/:id', requireFotografo, async (req, res) => {
  await dbRun('UPDATE portfolio SET categoria = ?, legenda = ? WHERE id = ? AND user_id = ?', [String(req.body.categoria || ''), String(req.body.legenda || ''), Number(req.params.id), req.user.id]);
  res.json({ ok: true, message: 'Atualizado.' });
});

app.delete('/api/fotografo/portfolio/:id', requireFotografo, async (req, res) => {
  const photo = await queryOne('SELECT * FROM portfolio WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
  if (photo) {
    await removeUploadFileIfExists(photo.url);
    await dbRun('DELETE FROM portfolio WHERE id = ?', [photo.id]);
  }
  res.json({ ok: true, message: 'Excluído.' });
});

// ----------------------------------------------------------------------------
// 9. PROJETOS, ORÇAMENTOS E CHAT INTEGRADO
// ----------------------------------------------------------------------------
app.get('/api/projetos', requireAuth, async (req, res) => {
  const user = req.user;
  const sql = user.tipo === 'fotografo'
    ? 'SELECT * FROM projetos WHERE profissional_id = ? ORDER BY id DESC'
    : user.tipo === 'cliente'
    ? 'SELECT * FROM projetos WHERE cliente_id = ? ORDER BY id DESC'
    : 'SELECT * FROM projetos ORDER BY id DESC';

  const params = user.tipo === 'admin' ? [] : [user.id];
  const rows = await queryAll(sql, params);
  const projetos = rows.map((p) => ({
    id_projeto: p.id,
    titulo: p.titulo,
    descricao: p.descricao,
    cidade: p.cidade,
    estado: p.estado,
    cliente: p.cliente_nome || 'Cliente Interessado',
    dataEvento: p.data_evento,
    valor: p.valor || '',
    metodo_pagamento: p.metodo_pagamento || '',
    status: p.status,
  }));
  res.json({ ok: true, projetos });
});

app.post('/api/projetos', requireAuth, async (req, res) => {
  const b = req.body || {};
  const profId = Number(b.profissionalId);
  const titulo = String(b.titulo || '').trim();
  const desc = String(b.descricao || '').trim();
  const cidade = String(b.cidade || '').trim();
  const estado = String(b.estado || '').trim().toUpperCase();
  const dataEvento = String(b.dataEvento || '');
  const valor = String(b.valor || '').trim();
  const metodo = String(b.metodoPagamento || b.metodo_pagamento || '').trim();

  if (!profId || !titulo || !desc || !cidade || !estado) {
    return res.status(400).json({ ok: false, message: 'Campos obrigatórios ausentes.' });
  }
  if (req.user.id === profId) {
    return res.status(400).json({ ok: false, message: 'Você não pode solicitar um orçamento para seu próprio perfil.' });
  }

  if (dataEvento) {
    const time = new Date(dataEvento).getTime();
    if (!isNaN(time) && time < Date.now() - 10 * 60 * 1000) {
      return res.status(400).json({ ok: false, message: 'A data do evento não pode estar no passado.' });
    }
  }

  await dbRun(
    `INSERT INTO projetos (profissional_id, cliente_id, cliente_nome, titulo, descricao, cidade, estado, data_evento, valor, metodo_pagamento, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aberto', ?)`,
    [profId, req.user.id, req.user.nome, titulo, desc, cidade, estado, dataEvento, valor, metodo, isoNow()]
  );
  const proj = await queryOne('SELECT id, titulo, valor, metodo_pagamento FROM projetos WHERE cliente_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]);
  res.json({ ok: true, message: 'Orçamento enviado com sucesso!', projeto: proj || {} });
});

app.put('/api/projetos/:id/status', requireAuth, async (req, res) => {
  await dbRun('UPDATE projetos SET status = ? WHERE id = ?', [String(req.body.status || 'aberto'), Number(req.params.id)]);
  res.json({ ok: true, message: 'Status atualizado.' });
});

app.get('/api/projetos/:id/mensagens', requireAuth, async (req, res) => {
  const proj = await queryOne('SELECT * FROM projetos WHERE id = ?', [Number(req.params.id)]);
  if (!proj) return res.status(404).json({ ok: false, message: 'Projeto não encontrado.' });
  if (req.user.tipo !== 'admin' && Number(proj.profissional_id) !== req.user.id && Number(proj.cliente_id) !== req.user.id) {
    return res.status(403).json({ ok: false, message: 'Não autorizado.' });
  }

  const mensagens = await queryAll('SELECT * FROM mensagens WHERE projeto_id = ? ORDER BY id ASC', [proj.id]);
  res.json({ ok: true, mensagens });
});

app.post('/api/projetos/:id/mensagens', requireAuth, async (req, res) => {
  const texto = String(req.body?.texto || '').trim();
  if (!texto) return res.status(400).json({ ok: false, message: 'Mensagem vazia.' });
  await dbRun(
    'INSERT INTO mensagens (projeto_id, remetente_id, remetente_nome, texto, created_at) VALUES (?, ?, ?, ?, ?)',
    [Number(req.params.id), req.user.id, req.user.nome, texto, isoNow()]
  );
  res.json({ ok: true, message: 'Enviada.' });
});

// Registrar Denúncia de Conversa / Usuário
app.post('/api/projetos/:id/denunciar', requireAuth, async (req, res) => {
  const projId = Number(req.params.id);
  const proj = await queryOne('SELECT * FROM projetos WHERE id = ?', [projId]);
  if (!proj) return res.status(404).json({ ok: false, message: 'Projeto não encontrado.' });

  const userId = req.user.id;
  const isCliente = Number(proj.cliente_id) === userId;
  const isFotografo = Number(proj.profissional_id) === userId;
  if (!isCliente && !isFotografo && req.user.tipo !== 'admin') {
    return res.status(403).json({ ok: false, message: 'Apenas participantes da conversa podem registrar denúncia.' });
  }

  const denunciadoId = isCliente ? proj.profissional_id : proj.cliente_id;
  const denunciadoUser = await getUserById(denunciadoId);
  const denunciadoNome = denunciadoUser ? denunciadoUser.nome : 'Usuário';

  const motivo = String(req.body?.motivo || 'Conteúdo impróprio ou conduta abusiva').trim();
  const detalhes = String(req.body?.detalhes || '').trim();

  await dbRun(
    `INSERT INTO denuncias (projeto_id, denunciante_id, denunciante_nome, denunciado_id, denunciado_nome, motivo, detalhes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?)`,
    [projId, req.user.id, req.user.nome, denunciadoId, denunciadoNome, motivo, detalhes, isoNow()]
  );

  const denuncia = await queryOne('SELECT * FROM denuncias WHERE denunciante_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]);
  res.status(201).json({ ok: true, message: 'Denúncia registrada com sucesso. A administração foi notificada para averiguação imediata.', denuncia });
});

// ----------------------------------------------------------------------------
// 10. ROTAS ADMINISTRATIVAS E SUPORTE
// ----------------------------------------------------------------------------
app.get('/api/users', async (req, res) => {
  const rows = await queryAll('SELECT * FROM users ORDER BY created_at DESC');
  res.json({ ok: true, users: rows.map(buildRow).map(publicUser) });
});

app.post('/api/users/:id/click-whatsapp', async (req, res) => {
  await dbRun('UPDATE users SET whatsapp_clicks = whatsapp_clicks + 1 WHERE id = ?', [Number(req.params.id)]);
  res.json({ ok: true });
});

app.post('/api/admin/reset-seed', requireAdmin, async (req, res) => {
  for (const t of ['users', 'portfolio', 'projetos', 'avaliacoes', 'mensagens', 'reset_requests', 'denuncias']) {
    await dbRun(`DELETE FROM ${t}`);
  }
  await ensureDemoUsers();
  res.json({ ok: true });
});

app.post('/api/password-reset', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ ok: false, message: 'E-mail obrigatório.' });
  await dbRun('INSERT INTO reset_requests (email, data_nascimento, created_at) VALUES (?, ?, ?)', [email, String(req.body?.dataNascimento || ''), isoNow()]);
  res.json({ ok: true, message: 'Solicitação registrada para aprovação do administrador.' });
});

app.get('/api/reset-requests', requireAdmin, async (req, res) => {
  const requests = await queryAll('SELECT * FROM reset_requests ORDER BY created_at DESC');
  res.json({ ok: true, requests });
});

app.post('/api/reset-requests/:email/approve', requireAdmin, async (req, res) => {
  const email = normalizeEmail(req.params.email);
  const defaultHash = await bcrypt.hash('fotecta123', 10);
  await dbRun('UPDATE users SET senha = ? WHERE email = ?', [defaultHash, email]);
  await dbRun('DELETE FROM reset_requests WHERE email = ?', [email]);
  res.json({ ok: true, message: 'Senha resetada para fotecta123.' });
});

// Admin: Denúncias Recebidas e Moderação
app.get('/api/admin/denuncias', requireAdmin, async (req, res) => {
  const denuncias = await queryAll('SELECT * FROM denuncias ORDER BY created_at DESC');
  res.json({ ok: true, denuncias });
});

app.post('/api/admin/denuncias/:id/resolver', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || 'resolvida');
  await dbRun('UPDATE denuncias SET status = ? WHERE id = ?', [status, id]);
  res.json({ ok: true, message: `Denúncia marcada como ${status}.` });
});

// Admin: Editar Nome e Senha do Usuário
app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  const target = await getUserById(targetId);
  if (!target) return res.status(404).json({ ok: false, message: 'Usuário não encontrado.' });

  const b = req.body || {};
  const nome = String(b.nome || target.nome).trim();
  const tipo = b.tipo && ['cliente', 'fotografo', 'admin'].includes(b.tipo) ? b.tipo : target.tipo;
  const localizacao = b.localizacao !== undefined ? String(b.localizacao).trim() : target.localizacao;

  if (!nome) return res.status(400).json({ ok: false, message: 'Nome é obrigatório.' });

  let senhaHash = target.senha;
  if (b.senha && String(b.senha).trim().length >= 6) {
    senhaHash = await bcrypt.hash(String(b.senha).trim(), 10);
  }

  await dbRun(
    'UPDATE users SET nome = ?, tipo = ?, localizacao = ?, senha = ? WHERE id = ?',
    [nome, tipo, localizacao, senhaHash, targetId]
  );

  const updated = await getUserById(targetId);
  res.json({ ok: true, message: 'Usuário atualizado com sucesso.', user: publicUser(updated) });
});

// Admin: Apagar Usuário
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ ok: false, message: 'Você não pode excluir sua própria conta de administrador.' });
  }

  await dbRun('DELETE FROM portfolio WHERE user_id = ?', [targetId]);
  await dbRun('DELETE FROM avaliacoes WHERE profissional_id = ? OR cliente_id = ?', [targetId, targetId]);
  await dbRun('DELETE FROM mensagens WHERE remetente_id = ?', [targetId]);
  await dbRun('DELETE FROM projetos WHERE profissional_id = ? OR cliente_id = ?', [targetId, targetId]);
  await dbRun('DELETE FROM denuncias WHERE denunciado_id = ? OR denunciante_id = ?', [targetId, targetId]);
  await dbRun('DELETE FROM users WHERE id = ?', [targetId]);

  res.json({ ok: true, message: 'Usuário e dados associados excluídos com sucesso.' });
});

// ----------------------------------------------------------------------------
// 11. INICIALIZAÇÃO DO SERVIDOR HTTP
// ----------------------------------------------------------------------------
if (require.main === module) {
  ready.then(() => {
    app.listen(port, () => console.log(`FOTECTA rodando em http://localhost:${port}`));
  });
}

module.exports = { app, ready, db, currentUser, requireRole };
