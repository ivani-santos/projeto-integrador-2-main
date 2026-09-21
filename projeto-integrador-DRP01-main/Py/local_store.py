"""Persistência local em arquivo JSON para o FOTECTA.

O estado fica em um arquivo temporário do sistema, sem SQL, sem banco externo
e sem migração. Isso é suficiente para o uso local e para a demonstração do app.
"""

from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime
from pathlib import Path
from threading import RLock

from werkzeug.security import check_password_hash, generate_password_hash


STORE_PATH = Path(tempfile.gettempdir()) / "fotecta_store.json"
_LOCK = RLock()


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _demo_users() -> list[dict]:
    return [
        {
            "id": 1,
            "nome": "Admin Demo",
            "email": "admin@fotecta.com",
            "senha": "admin123",
            "password_hash": generate_password_hash("admin123"),
            "tipo": "admin",
            "foto": None,
            "bio": "",
            "localizacao": "",
            "especialidades": [],
            "portfolio": [],
            "avaliacoes": [],
            "favoritos": [],
            "created_at": _now_iso(),
        },
        {
            "id": 2,
            "nome": "Cliente Demo",
            "email": "cliente@fotecta.com",
            "senha": "cliente123",
            "password_hash": generate_password_hash("cliente123"),
            "tipo": "cliente",
            "foto": None,
            "bio": "",
            "localizacao": "",
            "especialidades": [],
            "portfolio": [],
            "avaliacoes": [],
            "favoritos": [],
            "created_at": _now_iso(),
        },
        {
            "id": 3,
            "nome": "Fotógrafo Demo",
            "email": "fotografo@fotecta.com",
            "senha": "foto123",
            "password_hash": generate_password_hash("foto123"),
            "tipo": "fotografo",
            "foto": None,
            "bio": "",
            "localizacao": "",
            "especialidades": ["Casamentos"],
            "portfolio": [],
            "avaliacoes": [],
            "favoritos": [],
            "created_at": _now_iso(),
        },
    ]


def _default_state() -> dict:
    return {
        "next_user_id": 4,
        "users": _demo_users(),
        "reset_requests": [],
    }


def _normalize_user(user: dict) -> dict:
    normalized = dict(user)
    normalized.setdefault("foto", None)
    normalized.setdefault("bio", "")
    normalized.setdefault("localizacao", "")
    normalized.setdefault("especialidades", [])
    normalized.setdefault("portfolio", [])
    normalized.setdefault("avaliacoes", [])
    normalized.setdefault("favoritos", [])
    normalized.setdefault("created_at", _now_iso())
    return normalized


def _save_state(state: dict) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = STORE_PATH.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp_path, STORE_PATH)


def _load_state() -> dict:
    if not STORE_PATH.exists():
        state = _default_state()
        _save_state(state)
        return state

    try:
        state = json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except Exception:
        state = _default_state()
        _save_state(state)
        return state

    state.setdefault("next_user_id", 4)
    state.setdefault("users", [])
    state.setdefault("reset_requests", [])
    state["users"] = [_normalize_user(user) for user in state["users"]]
    return state


def _with_state(mutator):
    with _LOCK:
        state = _load_state()
        result = mutator(state)
        _save_state(state)
        return result


def ensure_seed_data() -> None:
    """Garante que as contas de demo existam no arquivo local."""

    def mutator(state: dict):
        users = state["users"]
        by_email = {user["email"].lower(): user for user in users}
        for demo in _demo_users():
            existing = by_email.get(demo["email"].lower())
            if existing is None:
                users.append(demo)
                continue
            existing.update(demo)

        max_id = max((int(user["id"]) for user in users if str(user.get("id")).isdigit()), default=0)
        state["next_user_id"] = max(state.get("next_user_id", 4), max_id + 1)

    _with_state(mutator)


def reset_seed() -> None:
    """Reinicia o arquivo temporário com apenas os usuários de demo."""

    with _LOCK:
        _save_state(_default_state())


def list_users() -> list[dict]:
    state = _load_state()
    return [dict(user) for user in state["users"]]


def get_user_by_id(user_id: int | str) -> dict | None:
    target = str(user_id)
    for user in _load_state()["users"]:
        if str(user["id"]) == target:
            return dict(user)
    return None


def get_user_by_email(email: str) -> dict | None:
    target = str(email or "").strip().lower()
    for user in _load_state()["users"]:
        if user["email"].lower() == target:
            return dict(user)
    return None


def create_user(payload: dict) -> tuple[bool, dict | str]:
    def mutator(state: dict):
        nome = str(payload.get("nome") or "").strip()
        email = str(payload.get("email") or "").strip().lower()
        senha = str(payload.get("senha") or "")
        tipo = str(payload.get("tipo") or "cliente").strip().lower()

        if not nome or not email or not senha:
            return False, "Nome, email e senha são obrigatórios."

        if any(user["email"].lower() == email for user in state["users"]):
            return False, "E-mail já cadastrado."

        user = _normalize_user(
            {
                "id": state["next_user_id"],
                "nome": nome,
                "email": email,
                "senha": senha,
                "password_hash": generate_password_hash(senha),
                "tipo": tipo,
                "foto": payload.get("foto"),
                "bio": payload.get("bio", ""),
                "localizacao": payload.get("localizacao", ""),
                "especialidades": list(payload.get("especialidades") or []),
                "portfolio": list(payload.get("portfolio") or []),
                "avaliacoes": list(payload.get("avaliacoes") or []),
                "favoritos": list(payload.get("favoritos") or []),
                "created_at": _now_iso(),
            }
        )
        state["next_user_id"] += 1
        state["users"].append(user)
        return True, dict(user)

    return _with_state(mutator)


def update_user(user_id: int | str, payload: dict) -> tuple[bool, dict | str]:
    def mutator(state: dict):
        target_id = str(user_id)
        user = next((item for item in state["users"] if str(item["id"]) == target_id), None)
        if user is None:
            return False, "Usuário não encontrado."

        new_email = str(payload.get("email") or user["email"]).strip().lower()
        if new_email != user["email"].lower() and any(other["email"].lower() == new_email for other in state["users"] if str(other["id"]) != target_id):
            return False, "E-mail já cadastrado."

        user["nome"] = str(payload.get("nome", user["nome"])).strip() or user["nome"]
        user["email"] = new_email
        user["tipo"] = str(payload.get("tipo", user.get("tipo", "cliente"))).strip().lower()
        user["foto"] = payload.get("foto", user.get("foto"))
        user["bio"] = payload.get("bio", user.get("bio", ""))
        user["localizacao"] = payload.get("localizacao", user.get("localizacao", ""))
        if payload.get("senha"):
            user["senha"] = str(payload.get("senha"))
            user["password_hash"] = generate_password_hash(str(payload.get("senha")))
        if "especialidades" in payload:
            user["especialidades"] = list(payload.get("especialidades") or [])
        if "portfolio" in payload:
            user["portfolio"] = list(payload.get("portfolio") or [])
        if "avaliacoes" in payload:
            user["avaliacoes"] = list(payload.get("avaliacoes") or [])
        if "favoritos" in payload:
            user["favoritos"] = list(payload.get("favoritos") or [])
        return True, dict(user)

    return _with_state(mutator)


def delete_user(user_id: int | str) -> tuple[bool, str]:
    def mutator(state: dict):
        target_id = str(user_id)
        before = len(state["users"])
        state["users"] = [user for user in state["users"] if str(user["id"]) != target_id]
        if len(state["users"]) == before:
            return False, "Usuário não encontrado."
        return True, "Usuário removido com sucesso."

    return _with_state(mutator)


def verify_user_password(email: str, password: str) -> dict | None:
    user = get_user_by_email(email)
    if not user:
        return None
    return user if check_password_hash(user["password_hash"], password) else None


def set_user_favorites(user_id: int | str, favorites: list[str]) -> tuple[bool, list[str] | str]:
    def mutator(state: dict):
        target_id = str(user_id)
        user = next((item for item in state["users"] if str(item["id"]) == target_id), None)
        if user is None:
            return False, "Usuário não encontrado."

        normalized = []
        for entry in favorites or []:
            value = str(entry or "").strip().lower()
            if value:
                normalized.append(value)
        user["favoritos"] = sorted(set(normalized))
        return True, list(user["favoritos"])

    return _with_state(mutator)


def get_user_favorites(user_id: int | str) -> list[str]:
    user = get_user_by_id(user_id)
    return list(user.get("favoritos", [])) if user else []


def add_reset_request(nome: str, email: str, nascimento: str | None) -> dict:
    def mutator(state: dict):
        request = {
            "nome": str(nome or "").strip(),
            "email": str(email or "").strip().lower(),
            "nascimento": nascimento,
            "created_at": _now_iso(),
        }
        state["reset_requests"] = [item for item in state["reset_requests"] if item["email"].lower() != request["email"]]
        state["reset_requests"].append(request)
        return dict(request)

    return _with_state(mutator)


def list_reset_requests() -> list[dict]:
    state = _load_state()
    return [dict(item) for item in state["reset_requests"]]


def approve_reset_request(email: str) -> tuple[bool, str]:
    def mutator(state: dict):
        target = str(email or "").strip().lower()
        user = next((item for item in state["users"] if item["email"].lower() == target), None)
        if user is None:
            return False, "Usuário não encontrado."

        user["password_hash"] = generate_password_hash("fotecta123")
        user["senha"] = "fotecta123"
        state["reset_requests"] = [item for item in state["reset_requests"] if item["email"].lower() != target]
        return True, "Senha resetada para fotecta123."

    return _with_state(mutator)


def reject_reset_request(email: str) -> tuple[bool, str]:
    def mutator(state: dict):
        target = str(email or "").strip().lower()
        before = len(state["reset_requests"])
        state["reset_requests"] = [item for item in state["reset_requests"] if item["email"].lower() != target]
        if len(state["reset_requests"]) == before:
            return False, "Solicitação não encontrada."
        return True, "Solicitação removida."

    return _with_state(mutator)
