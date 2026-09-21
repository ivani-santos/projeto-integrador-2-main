CREATE TABLE IF NOT EXISTS tb_usuario (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    nome TEXT NOT NULL,
    sobrenome TEXT,
    tipo TEXT NOT NULL CHECK (tipo IN ('admin', 'cliente', 'fotografo')),
    data_cadastro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    foto_perfil TEXT,
    biografia TEXT,
    localizacao TEXT,
    interesses TEXT,
    preco TEXT,
    instagram TEXT,
    facebook TEXT
);

CREATE TABLE IF NOT EXISTS tb_cliente (
    id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL UNIQUE,
    cpf TEXT UNIQUE,
    FOREIGN KEY (id_usuario) REFERENCES tb_usuario (id_usuario) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_profissional (
    id_profissional INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL UNIQUE,
    cnpj TEXT UNIQUE,
    FOREIGN KEY (id_usuario) REFERENCES tb_usuario (id_usuario) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_telefone (
    id_telefone INTEGER PRIMARY KEY AUTOINCREMENT,
    id_profissional INTEGER NOT NULL,
    numero TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('fixo', 'celular')),
    is_whatsapp INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (id_profissional) REFERENCES tb_profissional (id_profissional) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_rede_social (
    id_rede_social INTEGER PRIMARY KEY AUTOINCREMENT,
    id_profissional INTEGER NOT NULL,
    nome TEXT NOT NULL,
    url_perfil TEXT NOT NULL,
    FOREIGN KEY (id_profissional) REFERENCES tb_profissional (id_profissional) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_endereco (
    id_endereco INTEGER PRIMARY KEY AUTOINCREMENT,
    id_profissional INTEGER NOT NULL,
    logradouro TEXT,
    cidade TEXT NOT NULL,
    estado TEXT NOT NULL,
    cep TEXT NOT NULL,
    FOREIGN KEY (id_profissional) REFERENCES tb_profissional (id_profissional) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_nivel (
    id_nivel INTEGER PRIMARY KEY,
    nome_nivel TEXT NOT NULL,
    descricao TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tb_especialidade (
    id_especialidade INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_especialidade TEXT NOT NULL UNIQUE,
    descricao TEXT
);

CREATE TABLE IF NOT EXISTS tb_profissional_especialidade (
    id_profissional INTEGER NOT NULL,
    id_especialidade INTEGER NOT NULL,
    PRIMARY KEY (id_profissional, id_especialidade),
    FOREIGN KEY (id_profissional) REFERENCES tb_profissional (id_profissional) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_especialidade) REFERENCES tb_especialidade (id_especialidade) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_competencias (
    id_competencia INTEGER PRIMARY KEY AUTOINCREMENT,
    id_profissional INTEGER NOT NULL,
    id_especialidade INTEGER NOT NULL,
    id_nivel INTEGER NOT NULL,
    FOREIGN KEY (id_profissional) REFERENCES tb_profissional (id_profissional) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_especialidade) REFERENCES tb_especialidade (id_especialidade) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_nivel) REFERENCES tb_nivel (id_nivel) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_cat_pagamento (
    id_cat_pagamento INTEGER PRIMARY KEY,
    nome_metodo_pagamento TEXT NOT NULL,
    descricao TEXT
);

CREATE TABLE IF NOT EXISTS tb_portfolio (
    id_portfolio INTEGER PRIMARY KEY AUTOINCREMENT,
    id_profissional INTEGER NOT NULL,
    nome_portfolio TEXT NOT NULL,
    data_portfolio TEXT NOT NULL,
    url_arquivo TEXT NOT NULL,
    legenda TEXT,
    FOREIGN KEY (id_profissional) REFERENCES tb_profissional (id_profissional) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_midia (
    id_midia INTEGER PRIMARY KEY AUTOINCREMENT,
    id_portfolio INTEGER NOT NULL,
    nome TEXT,
    url_arquivo TEXT NOT NULL,
    legenda TEXT,
    FOREIGN KEY (id_portfolio) REFERENCES tb_portfolio (id_portfolio) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_metodo_pagamento (
    id_metodo_pagamento INTEGER PRIMARY KEY AUTOINCREMENT,
    id_profissional INTEGER NOT NULL,
    id_cat_pagamento INTEGER NOT NULL,
    condicao TEXT,
    FOREIGN KEY (id_profissional) REFERENCES tb_profissional (id_profissional) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_cat_pagamento) REFERENCES tb_cat_pagamento (id_cat_pagamento) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_avaliacao (
    id_avaliacao INTEGER PRIMARY KEY AUTOINCREMENT,
    id_profissional INTEGER NOT NULL,
    nome_cliente TEXT NOT NULL,
    comentario TEXT NOT NULL,
    nota INTEGER NOT NULL,
    resposta TEXT,
    data_avaliacao TEXT NOT NULL,
    data_resposta TEXT,
    FOREIGN KEY (id_profissional) REFERENCES tb_profissional (id_profissional) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_favorito (
    id_cliente INTEGER NOT NULL,
    id_profissional INTEGER NOT NULL,
    PRIMARY KEY (id_cliente, id_profissional),
    FOREIGN KEY (id_cliente) REFERENCES tb_cliente (id_cliente) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_profissional) REFERENCES tb_profissional (id_profissional) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_solicitacao_recuperacao (
    id_solicitacao INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    nascimento TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at TEXT NOT NULL,
    responded_at TEXT
);