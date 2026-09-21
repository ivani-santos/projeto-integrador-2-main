"""Persistência SQL local para o FOTECTA.

O app continua expondo a mesma API de dados usada pelo front, mas agora os
registros ficam em um banco SQLite local com schema SQL versionado.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path
from threading import RLock

from werkzeug.security import check_password_hash, generate_password_hash


ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = ROOT_DIR / "instance" / "fotecta.sqlite3"
SCHEMA_PATH = ROOT_DIR / "Banco de Dados" / "fotecta_schema.sql"
_LOCK = RLock()


def _now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds")


def _s(value, default: str = "") -> str:
    """Normaliza um valor textual retornando `str(value).strip()` com fallback."""
    return str(value or default).strip()


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _schema_sql() -> str:
    return SCHEMA_PATH.read_text(encoding="utf-8")


def _db_ready(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tb_usuario'"
    ).fetchone()
    return row is not None


def _seed_reference_data(conn: sqlite3.Connection) -> None:
    conn.executemany(
        "INSERT OR IGNORE INTO tb_nivel (id_nivel, nome_nivel, descricao) VALUES (?, ?, ?)",
        [
            (1, "Básico", "Conhecimento introdutório."),
            (2, "Intermediário", "Conhecimento aplicado com autonomia parcial."),
            (3, "Avançado", "Domínio consistente da especialidade."),
        ],
    )
    conn.executemany(
        "INSERT OR IGNORE INTO tb_especialidade (id_especialidade, nome_especialidade, descricao) VALUES (?, ?, ?)",
        [
            (1, "Casamentos", "Cobertura fotográfica de cerimônias e recepções."),
            (2, "Eventos", "Cobertura de eventos corporativos e sociais."),
            (3, "Ensaios", "Ensaios individuais, de casal ou família."),
            (4, "Publicidade", "Produção para marcas e campanhas."),
        ],
    )
    conn.executemany(
        "INSERT OR IGNORE INTO tb_cat_pagamento (id_cat_pagamento, nome_metodo_pagamento, descricao) VALUES (?, ?, ?)",
        [
            (1, "Pix", "Pagamento instantâneo via Pix."),
            (2, "Cartão de crédito", "Parcelamento conforme negociação."),
            (3, "Boleto", "Emissão de boleto bancário."),
        ],
    )


def _demo_users() -> list[dict]:
    return [
        {
            "id_usuario": 1,
            "login": "admin@fotecta.com",
            "senha": "admin123",
            "nome": "Admin Demo",
            "sobrenome": "",
            "tipo": "admin",
            "foto_perfil": None,
            "biografia": "",
            "localizacao": "",
            "interesses": "",
            "preco": "",
            "instagram": "",
            "facebook": "",
            "especialidades": [],
            "portfolio": [],
            "avaliacoes": [],
            "favoritos": [],
        },
        {
            "id_usuario": 2,
            "login": "cliente@fotecta.com",
            "senha": "cliente123",
            "nome": "Cliente Demo",
            "sobrenome": "",
            "tipo": "cliente",
            "foto_perfil": None,
            "biografia": "",
            "localizacao": "",
            "interesses": "Festas, retratos e eventos familiares.",
            "preco": "",
            "instagram": "",
            "facebook": "",
            "especialidades": [],
            "portfolio": [],
            "avaliacoes": [],
            "favoritos": ["fotografo@fotecta.com"],
        },
        {
            "id_usuario": 3,
            "login": "fotografo@fotecta.com",
            "senha": "foto123",
            "nome": "Fotógrafo Demo",
            "sobrenome": "",
            "tipo": "fotografo",
            "foto_perfil": None,
            "biografia": "Profissional de demonstração do FOTECTA.",
            "localizacao": "São Paulo, SP",
            "interesses": "",
            "preco": "Sob consulta",
            "instagram": "@fotodemo",
            "facebook": "https://facebook.com/fotodemo",
            "especialidades": ["Casamentos"],
            "portfolio": [],
            "avaliacoes": [
                {
                    "cliente": "Cliente Demo",
                    "texto": "Atendimento rápido e ótimo resultado.",
                    "nota": 5,
                    "data": "2026-04-27",
                    "resposta": "Obrigado pelo feedback!",
                }
            ],
            "favoritos": [],
        },
    ]


def _create_profile_row(conn: sqlite3.Connection, user: dict) -> None:
    if user["tipo"] == "cliente":
        conn.execute(
            "INSERT OR IGNORE INTO tb_cliente (id_usuario, cpf) VALUES (?, ?)",
            (user["id_usuario"], None),
        )
    elif user["tipo"] == "fotografo":
        conn.execute(
            "INSERT OR IGNORE INTO tb_profissional (id_usuario, cnpj) VALUES (?, ?)",
            (user["id_usuario"], None),
        )


def _sync_specialidades(conn: sqlite3.Connection, id_usuario: int, especialidades: list[str]) -> None:
    prof_row = conn.execute(
        "SELECT id_profissional FROM tb_profissional WHERE id_usuario = ?",
        (id_usuario,),
    ).fetchone()
    if prof_row is None:
        return

    id_profissional = int(prof_row["id_profissional"])
    conn.execute("DELETE FROM tb_profissional_especialidade WHERE id_profissional = ?", (id_profissional,))
    for nome in especialidades:
        nome_limpo = str(nome or "").strip()
        if not nome_limpo:
            continue
        conn.execute(
            "INSERT OR IGNORE INTO tb_especialidade (nome_especialidade, descricao) VALUES (?, ?)",
            (nome_limpo, None),
        )
        esp_row = conn.execute(
            "SELECT id_especialidade FROM tb_especialidade WHERE lower(nome_especialidade) = lower(?)",
            (nome_limpo,),
        ).fetchone()
        if esp_row is not None:
            conn.execute(
                "INSERT OR IGNORE INTO tb_profissional_especialidade (id_profissional, id_especialidade) VALUES (?, ?)",
                (id_profissional, int(esp_row["id_especialidade"])),
            )


def _sync_portfolio(conn: sqlite3.Connection, id_usuario: int, portfolio: list[str]) -> None:
    prof_row = conn.execute(
        "SELECT id_profissional FROM tb_profissional WHERE id_usuario = ?",
        (id_usuario,),
    ).fetchone()
    if prof_row is None:
        return

    id_profissional = int(prof_row["id_profissional"])
    conn.execute("DELETE FROM tb_portfolio WHERE id_profissional = ?", (id_profissional,))
    for index, item in enumerate(portfolio, start=1):
        valor = str(item or "").strip()
        if not valor:
            continue
        conn.execute(
            """
            INSERT INTO tb_portfolio (id_profissional, nome_portfolio, data_portfolio, url_arquivo, legenda)
            VALUES (?, ?, ?, ?, ?)
            """,
            (id_profissional, f"Foto {index}", _now_iso(), valor, None),
        )


def _sync_avaliacoes(conn: sqlite3.Connection, id_usuario: int, avaliacoes: list[dict]) -> None:
    prof_row = conn.execute(
        "SELECT id_profissional FROM tb_profissional WHERE id_usuario = ?",
        (id_usuario,),
    ).fetchone()
    if prof_row is None:
        return

    id_profissional = int(prof_row["id_profissional"])
    conn.execute("DELETE FROM tb_avaliacao WHERE id_profissional = ?", (id_profissional,))
    for item in avaliacoes:
        if not isinstance(item, dict):
            continue
        conn.execute(
            """
            INSERT INTO tb_avaliacao
                (id_profissional, nome_cliente, comentario, nota, resposta, data_avaliacao, data_resposta)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                id_profissional,
                str(item.get("cliente") or item.get("nome_cliente") or "Cliente").strip(),
                str(item.get("texto") or item.get("comentario") or "").strip(),
                int(item.get("nota") or 5),
                str(item.get("resposta") or "").strip() or None,
                str(item.get("data") or _now_iso()).strip(),
                str(item.get("data_resposta") or "").strip() or None,
            ),
        )


def _sync_favoritos(conn: sqlite3.Connection, id_usuario: int, favoritos: list[str]) -> list[str]:
    cliente_row = conn.execute(
        "SELECT id_cliente FROM tb_cliente WHERE id_usuario = ?",
        (id_usuario,),
    ).fetchone()
    if cliente_row is None:
        return []

    id_cliente = int(cliente_row["id_cliente"])
    conn.execute("DELETE FROM tb_favorito WHERE id_cliente = ?", (id_cliente,))

    favoritos_normalizados = []
    for entry in favoritos or []:
        valor = str(entry or "").strip().lower()
        if not valor:
            continue
        if valor.isdigit():
            usuario_row = conn.execute(
                "SELECT id_usuario, login FROM tb_usuario WHERE id_usuario = ? AND tipo = 'fotografo'",
                (int(valor),),
            ).fetchone()
        else:
            usuario_row = conn.execute(
                "SELECT id_usuario, login FROM tb_usuario WHERE lower(login) = lower(?) AND tipo = 'fotografo'",
                (valor,),
            ).fetchone()
        if usuario_row is None:
            continue
        conn.execute(
            "INSERT OR IGNORE INTO tb_favorito (id_cliente, id_profissional) VALUES (?, (SELECT id_profissional FROM tb_profissional WHERE id_usuario = ?))",
            (id_cliente, int(usuario_row["id_usuario"])),
        )
        favoritos_normalizados.append(str(usuario_row["login"]).lower())

    return sorted(set(favoritos_normalizados))


def _row_to_user(conn: sqlite3.Connection, row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None

    user = {
        "id": int(row["id_usuario"]),
        "nome": row["nome"] or "",
        "sobrenome": row["sobrenome"] or "",
        "email": row["login"] or "",
        "senha": row["senha"] or "",
        "password_hash": row["senha_hash"] or "",
        "tipo": row["tipo"] or "cliente",
        "foto": row["foto_perfil"],
        "bio": row["biografia"] or "",
        "localizacao": row["localizacao"] or "",
        "interesses": row["interesses"] or "",
        "preco": row["preco"] or "",
        "instagram": row["instagram"] or "",
        "facebook": row["facebook"] or "",
        "especialidades": [],
        "portfolio": [],
        "avaliacoes": [],
        "favoritos": [],
        "created_at": row["data_cadastro"] or _now_iso(),
        "whatsapp_clicks": 0,
        "favorited_by_count": 0,
    }

    if "whatsapp_clicks" in row.keys():
        user["whatsapp_clicks"] = int(row["whatsapp_clicks"] or 0)

    if user["tipo"] == "cliente":
        favoritos_rows = conn.execute(
            """
            SELECT u.login
            FROM tb_favorito f
            JOIN tb_profissional p ON p.id_profissional = f.id_profissional
            JOIN tb_usuario u ON u.id_usuario = p.id_usuario
            WHERE f.id_cliente = (
                SELECT id_cliente FROM tb_cliente WHERE id_usuario = ?
            )
            ORDER BY u.login
            """,
            (user["id"],),
        ).fetchall()
        user["favoritos"] = [str(item["login"]).lower() for item in favoritos_rows]

    if user["tipo"] == "fotografo":
        prof_row = conn.execute(
            "SELECT id_profissional FROM tb_profissional WHERE id_usuario = ?",
            (user["id"],),
        ).fetchone()
        if prof_row is not None:
            id_profissional = int(prof_row["id_profissional"])
            especialidades_rows = conn.execute(
                """
                SELECT e.nome_especialidade
                FROM tb_profissional_especialidade pe
                JOIN tb_especialidade e ON e.id_especialidade = pe.id_especialidade
                WHERE pe.id_profissional = ?
                ORDER BY e.nome_especialidade
                """,
                (id_profissional,),
            ).fetchall()
            user["especialidades"] = [str(item["nome_especialidade"]) for item in especialidades_rows]

            portfolio_rows = conn.execute(
                """
                SELECT url_arquivo
                FROM tb_portfolio
                WHERE id_profissional = ?
                ORDER BY id_portfolio ASC
                """,
                (id_profissional,),
            ).fetchall()
            user["portfolio"] = [str(item["url_arquivo"]) for item in portfolio_rows]

            avaliacoes_rows = conn.execute(
                """
                SELECT nome_cliente, comentario, nota, resposta, data_avaliacao, data_resposta
                FROM tb_avaliacao
                WHERE id_profissional = ?
                ORDER BY id_avaliacao ASC
                """,
                (id_profissional,),
            ).fetchall()
            user["avaliacoes"] = [
                {
                    "cliente": str(item["nome_cliente"]),
                    "texto": str(item["comentario"]),
                    "nota": int(item["nota"] or 5),
                    "data": str(item["data_avaliacao"]),
                    "resposta": str(item["resposta"] or ""),
                }
                for item in avaliacoes_rows
            ]

            fav_count_row = conn.execute(
                "SELECT COUNT(*) AS total FROM tb_favorito WHERE id_profissional = ?",
                (id_profissional,),
            ).fetchone()
            user["favorited_by_count"] = int(fav_count_row["total"]) if fav_count_row else 0

    return user


def _seed_demo_data(conn: sqlite3.Connection) -> None:
    for demo in _demo_users():
        conn.execute(
            """
            INSERT OR REPLACE INTO tb_usuario
                (id_usuario, login, senha, senha_hash, nome, sobrenome, tipo, data_cadastro,
                 foto_perfil, biografia, localizacao, interesses, preco, instagram, facebook)
            VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT data_cadastro FROM tb_usuario WHERE id_usuario = ?), ?), ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                demo["id_usuario"],
                demo["login"],
                demo["senha"],
                generate_password_hash(demo["senha"]),
                demo["nome"],
                demo["sobrenome"],
                demo["tipo"],
                demo["id_usuario"],
                _now_iso(),
                demo["foto_perfil"],
                demo["biografia"],
                demo["localizacao"],
                demo["interesses"],
                demo["preco"],
                demo["instagram"],
                demo["facebook"],
            ),
        )
        _create_profile_row(conn, demo)

        if demo["tipo"] == "cliente":
            favoritos = _sync_favoritos(conn, demo["id_usuario"], demo["favoritos"])
            if favoritos:
                conn.execute(
                    "UPDATE tb_usuario SET interesses = interesses WHERE id_usuario = ?",
                    (demo["id_usuario"],),
                )
        elif demo["tipo"] == "fotografo":
            _sync_specialidades(conn, demo["id_usuario"], demo["especialidades"])
            _sync_portfolio(conn, demo["id_usuario"], demo["portfolio"])
            _sync_avaliacoes(conn, demo["id_usuario"], demo["avaliacoes"])


def _ensure_whatsapp_clicks_column(conn: sqlite3.Connection) -> None:
    try:
        conn.execute("ALTER TABLE tb_usuario ADD COLUMN whatsapp_clicks INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass  # A coluna já existe, ignoramos o erro silenciosamente

def _initialize_database(conn: sqlite3.Connection) -> None:
    if not _db_ready(conn):
        conn.executescript(_schema_sql())
    _seed_reference_data(conn)
    _ensure_whatsapp_clicks_column(conn)
    user_count = conn.execute("SELECT COUNT(*) AS total FROM tb_usuario").fetchone()["total"]
    if int(user_count) == 0:
        _seed_demo_data(conn)


def _with_connection(handler):
    with _LOCK:
        with _connect() as conn:
            _initialize_database(conn)
            result = handler(conn)
            conn.commit()
            return result


def ensure_seed_data() -> None:
    """Garante que as contas de demo existam no banco local."""

    def handler(conn: sqlite3.Connection):
        for demo in _demo_users():
            row = conn.execute(
                "SELECT id_usuario FROM tb_usuario WHERE lower(login) = lower(?)",
                (demo["login"],),
            ).fetchone()
            if row is None:
                conn.execute(
                    """
                    INSERT INTO tb_usuario
                        (id_usuario, login, senha, senha_hash, nome, sobrenome, tipo, data_cadastro,
                         foto_perfil, biografia, localizacao, interesses, preco, instagram, facebook)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        demo["id_usuario"],
                        demo["login"],
                        demo["senha"],
                        generate_password_hash(demo["senha"]),
                        demo["nome"],
                        demo["sobrenome"],
                        demo["tipo"],
                        _now_iso(),
                        demo["foto_perfil"],
                        demo["biografia"],
                        demo["localizacao"],
                        demo["interesses"],
                        demo["preco"],
                        demo["instagram"],
                        demo["facebook"],
                    ),
                )
            else:
                conn.execute(
                    """
                    UPDATE tb_usuario
                    SET senha = ?, senha_hash = ?, nome = ?, sobrenome = ?, tipo = ?, foto_perfil = ?,
                        biografia = ?, localizacao = ?, interesses = ?, preco = ?, instagram = ?, facebook = ?
                    WHERE id_usuario = ?
                    """,
                    (
                        demo["senha"],
                        generate_password_hash(demo["senha"]),
                        demo["nome"],
                        demo["sobrenome"],
                        demo["tipo"],
                        demo["foto_perfil"],
                        demo["biografia"],
                        demo["localizacao"],
                        demo["interesses"],
                        demo["preco"],
                        demo["instagram"],
                        demo["facebook"],
                        int(row["id_usuario"]),
                    ),
                )

            conn.execute("DELETE FROM tb_cliente WHERE id_usuario = ?", (demo["id_usuario"],))
            conn.execute("DELETE FROM tb_profissional WHERE id_usuario = ?", (demo["id_usuario"],))
            _create_profile_row(conn, demo)

            if demo["tipo"] == "cliente":
                _sync_favoritos(conn, demo["id_usuario"], demo["favoritos"])
            elif demo["tipo"] == "fotografo":
                _sync_specialidades(conn, demo["id_usuario"], demo["especialidades"])
                _sync_portfolio(conn, demo["id_usuario"], demo["portfolio"])
                _sync_avaliacoes(conn, demo["id_usuario"], demo["avaliacoes"])

    _with_connection(handler)


def reset_seed() -> None:
    """Reinicia o banco local com apenas os usuários de demo.

    Esta função remove todos os dados de usuário (tabelas relacionadas)
    e reaplica os dados de referência e as contas de demonstração.
    Útil para desenvolvimento e testes locais.
    """

    def handler(conn: sqlite3.Connection):
        for table in [
            "tb_favorito",
            "tb_avaliacao",
            "tb_portfolio",
            "tb_profissional_especialidade",
            "tb_profissional",
            "tb_cliente",
            "tb_solicitacao_recuperacao",
            "tb_metodo_pagamento",
            "tb_competencias",
            "tb_rede_social",
            "tb_telefone",
            "tb_endereco",
            "tb_usuario",
        ]:
            conn.execute(f"DELETE FROM {table}")
        conn.execute("DELETE FROM sqlite_sequence")
        _seed_reference_data(conn)
        _seed_demo_data(conn)

    _with_connection(handler)


def list_users() -> list[dict]:
    """Retorna a lista completa de usuários no formato usado pelo front-end."""

    def handler(conn: sqlite3.Connection):
        rows = conn.execute("SELECT * FROM tb_usuario ORDER BY id_usuario ASC").fetchall()
        return [_row_to_user(conn, row) for row in rows]

    return _with_connection(handler)


def get_user_by_id(user_id: int | str) -> dict | None:
    """Retorna um usuário pelo seu `id` ou `None` se não existir."""

    def handler(conn: sqlite3.Connection):
        row = conn.execute("SELECT * FROM tb_usuario WHERE id_usuario = ?", (int(user_id),)).fetchone()
        return _row_to_user(conn, row)

    return _with_connection(handler)


def get_user_by_email(email: str) -> dict | None:
    """Retorna um usuário pelo `email` (login) ou `None` se não existir."""

    target = str(email or "").strip().lower()

    def handler(conn: sqlite3.Connection):
        row = conn.execute("SELECT * FROM tb_usuario WHERE lower(login) = lower(?)", (target,)).fetchone()
        return _row_to_user(conn, row)

    return _with_connection(handler)


def _validate_create_payload(payload: dict) -> tuple[str, str, str, str, str]:
    nome = _s(payload.get("nome"))
    if not nome:
        primeiro = _s(payload.get("firstName") or payload.get("primeiro_nome"))
        sobrenome = _s(payload.get("lastName") or payload.get("sobrenome") or payload.get("ultimo_nome"))
        nome = _s(" ".join(part for part in [primeiro, sobrenome] if part))
    sobrenome = _s(payload.get("sobrenome") or payload.get("lastName"))
    email = _s(payload.get("email") or payload.get("login")).lower()
    senha = _s(payload.get("senha") or payload.get("password1") or payload.get("password"))
    tipo = _s(payload.get("tipo") or payload.get("tipoPerfil") or "cliente").lower()
    return nome, sobrenome, email, senha, tipo


def create_user(payload: dict) -> tuple[bool, dict | str]:
    """Cria um novo usuário a partir do `payload` fornecido.

    Retorna `(True, user_dict)` em caso de sucesso ou `(False, mensagem)` em caso de erro.
    """

    def handler(conn: sqlite3.Connection):
        nome, sobrenome, email, senha, tipo = _validate_create_payload(payload)
        if not nome or not email or not senha:
            return False, "Nome, email e senha são obrigatórios."

        if conn.execute("SELECT 1 FROM tb_usuario WHERE lower(login) = lower(?)", (email,)).fetchone():
            return False, "E-mail já cadastrado."

        conn.execute(
            """
            INSERT INTO tb_usuario
                (login, senha, senha_hash, nome, sobrenome, tipo, data_cadastro, foto_perfil,
                 biografia, localizacao, interesses, preco, instagram, facebook)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                email,
                senha,
                generate_password_hash(senha),
                nome,
                sobrenome,
                tipo,
                _now_iso(),
                payload.get("foto") or payload.get("foto_perfil"),
                str(payload.get("bio") or payload.get("biografia") or "").strip(),
                str(payload.get("localizacao") or "").strip(),
                str(payload.get("interesses") or "").strip(),
                str(payload.get("preco") or "").strip(),
                str(payload.get("instagram") or "").strip(),
                str(payload.get("facebook") or "").strip(),
            ),
        )
        user_id = int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
        _create_profile_row(conn, {"id_usuario": user_id, "tipo": tipo})

        if tipo == "cliente":
            _sync_favoritos(conn, user_id, list(payload.get("favoritos") or []))
        elif tipo == "fotografo":
            _sync_specialidades(conn, user_id, list(payload.get("especialidades") or []))
            _sync_portfolio(conn, user_id, list(payload.get("portfolio") or []))
            _sync_avaliacoes(conn, user_id, list(payload.get("avaliacoes") or []))

        fresh_row = conn.execute("SELECT * FROM tb_usuario WHERE id_usuario = ?", (user_id,)).fetchone()
        return True, _row_to_user(conn, fresh_row)

    return _with_connection(handler)


def update_user(user_id: int | str, payload: dict) -> tuple[bool, dict | str]:
    """Atualiza o usuário identificado por `user_id` com os campos em `payload`.

    Retorna `(True, user_dict)` em caso de sucesso ou `(False, mensagem)` em caso de erro.
    """

    def handler(conn: sqlite3.Connection):
        row = conn.execute("SELECT * FROM tb_usuario WHERE id_usuario = ?", (int(user_id),)).fetchone()
        if row is None:
            return False, "Usuário não encontrado."

        current = _row_to_user(conn, row)
        new_email = str(payload.get("email") or current["email"]).strip().lower()
        if new_email != current["email"].lower():
            duplicate = conn.execute(
                "SELECT 1 FROM tb_usuario WHERE lower(login) = lower(?) AND id_usuario <> ?",
                (new_email, int(user_id)),
            ).fetchone()
            if duplicate:
                return False, "E-mail já cadastrado."

        new_nome = _s(payload.get("nome")) or current["nome"]
        new_sobrenome = _s(payload.get("sobrenome") or current.get("sobrenome"))
        new_tipo = _s(payload.get("tipo") or current["tipo"]).lower()
        senha = _s(payload.get("senha") or "")
        foto = payload.get("foto", current.get("foto"))
        bio = _s(payload.get("bio") or payload.get("biografia") or current.get("bio"))
        localizacao = _s(payload.get("localizacao") or current.get("localizacao"))
        interesses = _s(payload.get("interesses") or current.get("interesses"))
        preco = _s(payload.get("preco") or current.get("preco"))
        instagram = _s(payload.get("instagram") or current.get("instagram"))
        facebook = _s(payload.get("facebook") or current.get("facebook"))

        conn.execute(
            """
            UPDATE tb_usuario
            SET login = ?, nome = ?, sobrenome = ?, tipo = ?, foto_perfil = ?, biografia = ?,
                localizacao = ?, interesses = ?, preco = ?, instagram = ?, facebook = ?
            WHERE id_usuario = ?
            """,
            (new_email, new_nome, new_sobrenome, new_tipo, foto, bio, localizacao, interesses, preco, instagram, facebook, int(user_id)),
        )

        if senha:
            conn.execute(
                "UPDATE tb_usuario SET senha = ?, senha_hash = ? WHERE id_usuario = ?",
                (senha, generate_password_hash(senha), int(user_id)),
            )

        conn.execute("DELETE FROM tb_cliente WHERE id_usuario = ?", (int(user_id),))
        conn.execute("DELETE FROM tb_profissional WHERE id_usuario = ?", (int(user_id),))
        _create_profile_row(conn, {"id_usuario": int(user_id), "tipo": new_tipo})

        if "favoritos" in payload:
            _sync_favoritos(conn, int(user_id), list(payload.get("favoritos") or []))
        if "especialidades" in payload or new_tipo == "fotografo":
            _sync_specialidades(conn, int(user_id), list(payload.get("especialidades") or []))
        if "portfolio" in payload or new_tipo == "fotografo":
            _sync_portfolio(conn, int(user_id), list(payload.get("portfolio") or []))
        if "avaliacoes" in payload or new_tipo == "fotografo":
            _sync_avaliacoes(conn, int(user_id), list(payload.get("avaliacoes") or []))

        fresh_row = conn.execute("SELECT * FROM tb_usuario WHERE id_usuario = ?", (int(user_id),)).fetchone()
        return True, _row_to_user(conn, fresh_row)

    return _with_connection(handler)


def delete_user(user_id: int | str) -> tuple[bool, str]:
    """Remove o usuário indicado por `user_id` do banco de dados."""

    def handler(conn: sqlite3.Connection):
        row = conn.execute("SELECT 1 FROM tb_usuario WHERE id_usuario = ?", (int(user_id),)).fetchone()
        if row is None:
            return False, "Usuário não encontrado."
        conn.execute("DELETE FROM tb_usuario WHERE id_usuario = ?", (int(user_id),))
        return True, "Usuário removido com sucesso."

    return _with_connection(handler)


def verify_user_password(email: str, password: str) -> dict | None:
    """Verifica as credenciais do usuário.

    Retorna o dicionário do usuário quando a senha confere, ou `None` caso contrário.
    """

    user = get_user_by_email(email)
    if not user:
        return None
    return user if check_password_hash(user["password_hash"], password) else None


def set_user_favorites(user_id: int | str, favorites: list[str]) -> tuple[bool, list[str] | str]:
    """Define a lista de favoritos de um cliente e retorna a lista normalizada.

    Em caso de usuário inexistente retorna `(False, mensagem)`.
    """

    def handler(conn: sqlite3.Connection):
        row = conn.execute("SELECT * FROM tb_usuario WHERE id_usuario = ?", (int(user_id),)).fetchone()
        if row is None:
            return False, "Usuário não encontrado."

        normalizados = _sync_favoritos(conn, int(user_id), list(favorites or []))
        return True, normalizados

    return _with_connection(handler)


def get_user_favorites(user_id: int | str) -> list[str]:
    """Retorna a lista de favoritos para um cliente (ou lista vazia)."""

    user = get_user_by_id(user_id)
    return list(user.get("favoritos", [])) if user else []


def increment_whatsapp_clicks(user_id: int | str) -> tuple[bool, str]:
    """Incrementa a contagem de cliques do botão do WhatsApp para um determinado usuário."""
    def handler(conn: sqlite3.Connection):
        row = conn.execute("SELECT 1 FROM tb_usuario WHERE id_usuario = ?", (int(user_id),)).fetchone()
        if row is None:
            return False, "Usuário não encontrado."
        conn.execute("UPDATE tb_usuario SET whatsapp_clicks = COALESCE(whatsapp_clicks, 0) + 1 WHERE id_usuario = ?", (int(user_id),))
        return True, "Clique registrado."

    return _with_connection(handler)

def add_reset_request(nome: str, email: str, nascimento: str | None) -> dict:
    """Cria ou atualiza um pedido de recuperação de senha.

    Retorna o registro criado/atualizado.
    """

    def handler(conn: sqlite3.Connection):
        request = {
            "nome": str(nome or "").strip(),
            "email": str(email or "").strip().lower(),
            "nascimento": str(nascimento or "").strip() or None,
            "status": "pendente",
            "created_at": _now_iso(),
        }
        conn.execute(
            """
            INSERT INTO tb_solicitacao_recuperacao (nome, email, nascimento, status, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                nome = excluded.nome,
                nascimento = excluded.nascimento,
                status = excluded.status,
                created_at = excluded.created_at
            """,
            (request["nome"], request["email"], request["nascimento"], request["status"], request["created_at"]),
        )
        return dict(request)

    return _with_connection(handler)


def list_reset_requests() -> list[dict]:
    def handler(conn: sqlite3.Connection):
        rows = conn.execute(
            "SELECT nome, email, nascimento, status, created_at FROM tb_solicitacao_recuperacao ORDER BY created_at DESC"
        ).fetchall()
        return [dict(row) for row in rows]

    return _with_connection(handler)


def approve_reset_request(email: str) -> tuple[bool, str]:
    def handler(conn: sqlite3.Connection):
        target = str(email or "").strip().lower()
        user_row = conn.execute("SELECT id_usuario FROM tb_usuario WHERE lower(login) = lower(?)", (target,)).fetchone()
        if user_row is None:
            return False, "Usuário não encontrado."

        conn.execute(
            "UPDATE tb_usuario SET senha = ?, senha_hash = ? WHERE id_usuario = ?",
            ("fotecta123", generate_password_hash("fotecta123"), int(user_row["id_usuario"])),
        )
        conn.execute("DELETE FROM tb_solicitacao_recuperacao WHERE lower(email) = lower(?)", (target,))
        return True, "Senha resetada para fotecta123."

    return _with_connection(handler)


def reject_reset_request(email: str) -> tuple[bool, str]:
    def handler(conn: sqlite3.Connection):
        target = str(email or "").strip().lower()
        before = conn.execute(
            "SELECT COUNT(*) AS total FROM tb_solicitacao_recuperacao WHERE lower(email) = lower(?)",
            (target,),
        ).fetchone()["total"]
        conn.execute("DELETE FROM tb_solicitacao_recuperacao WHERE lower(email) = lower(?)", (target,))
        after = conn.execute(
            "SELECT COUNT(*) AS total FROM tb_solicitacao_recuperacao WHERE lower(email) = lower(?)",
            (target,),
        ).fetchone()["total"]
        if int(before) == int(after):
            return False, "Solicitação não encontrada."
        return True, "Solicitação removida."

    return _with_connection(handler)
