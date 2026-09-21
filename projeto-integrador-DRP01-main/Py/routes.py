from flask import jsonify, render_template, request, session
import os

from Py.sql_store import (
    add_reset_request,
    approve_reset_request,
    create_user,
    delete_user,
    ensure_seed_data,
    get_user_by_email,
    get_user_by_id,
    list_reset_requests,
    list_users,
    reject_reset_request,
    reset_seed,
    set_user_favorites,
    increment_whatsapp_clicks,
    update_user,
    verify_user_password,
)
from Py.main import app


def render_page(template_name):
    """Renderiza uma página HTML (pequeno wrapper para `render_template`)."""
    return render_template(template_name)


def public_user(user):
    """Retorna uma cópia do `user` sem campos sensíveis (ex.: `password_hash`)."""
    if not user:
        return None
    data = dict(user)
    data.pop('password_hash', None)
    return data


def current_user():
    """Retorna o usuário atualmente autenticado (ou `None`)."""
    user_id = session.get('user_id')
    return get_user_by_id(user_id) if user_id else None


def require_current_user(user_id):
    """Valida se o `user_id` corresponde ao usuário atual ou se é admin.

    Retorna `(user, None)` em caso de sucesso ou `(None, (response, status))` em caso de erro.
    """
    user = current_user()
    if not user:
        return None, (jsonify(ok=False, message='Não autenticado.'), 401)
    if str(user['id']) != str(user_id) and user.get('tipo') != 'admin':
        return None, (jsonify(ok=False, message='Não autorizado.'), 403)
    return user, None


def require_admin():
    """Verifica se o usuário atual é administrador.

    Retorna `(user, None)` se for admin ou `(None, (response, status))` caso contrário.
    """
    user = current_user()
    if not user or user.get('tipo') != 'admin':
        return None, (jsonify(ok=False, message='Não autorizado.'), 403)
    return user, None


@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json() or request.form
    ok, result = create_user(data)
    if not ok:
        return jsonify(ok=False, message=result), 400

    session['user_id'] = result['id']
    return jsonify(ok=True, user=public_user(result)), 201


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or request.form
    email = (data.get('email') or '').strip().lower()
    senha = data.get('senha')

    if not email or not senha:
        return jsonify(ok=False, message='E-mail e senha obrigatórios.'), 400

    user = verify_user_password(email, senha)
    if not user:
        return jsonify(ok=False, message='Credenciais inválidas.'), 401

    session['user_id'] = user['id']
    return jsonify(ok=True, user=public_user(user))


@app.route('/api/me')
def api_me():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify(ok=False, user=None)
    user = get_user_by_id(user_id)
    if not user:
        return jsonify(ok=False, user=None)
    return jsonify(ok=True, user=public_user(user))


@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify(ok=True)


@app.route('/api/password-reset', methods=['POST'])
def api_password_reset():
    """Endpoint simples para simular envio de e-mail de recuperação.

    Recebe `email` e `nascimento` (opcional). Para fins didáticos, se o
    e-mail existir retornamos uma resposta de sucesso e simulamos o envio.
    """
    data = request.get_json() or request.form
    email = (data.get('email') or '').strip().lower()
    nascimento = data.get('nascimento')

    if not email:
        return jsonify(ok=False, message='E-mail obrigatório.'), 400

    user = get_user_by_email(email)
    if not user:
        return jsonify(ok=False, message='E-mail não encontrado.'), 404

    add_reset_request(user['nome'], email, nascimento)
    app.logger.info(f"[SIMULADO] Solicitação de recuperação registrada para: {email}")
    return jsonify(ok=True, message='E-mail de recuperação enviado (simulado).')


@app.route('/api/users/<int:user_id>/favoritos', methods=['GET', 'POST'])
def api_user_favoritos(user_id):
    user, error = require_current_user(user_id)
    if error:
        return error

    if request.method == 'GET':
        return jsonify(ok=True, favoritos=(user or {}).get('favoritos', []))

    if user.get('tipo') != 'cliente':
        return jsonify(ok=False, message='Apenas clientes podem favoritar profissionais.'), 403

    data = request.get_json() or request.form
    favs = data.get('favoritos') or []
    ok, result = set_user_favorites(user_id, favs)
    if not ok:
        return jsonify(ok=False, message=result), 400
    return jsonify(ok=True, favoritos=result)


@app.route('/api/users', methods=['GET'])
def api_users():
    tipo = request.args.get('tipo')
    users = list_users()
    if tipo:
        users = [user for user in users if user.get('tipo') == tipo]
        
    # Ordena a lista usando a contagem de favoritos, do maior (top) para o menor
    users = sorted(users, key=lambda u: u.get('favorited_by_count', 0), reverse=True)
    
    return jsonify(ok=True, users=[public_user(user) for user in users])


@app.route('/api/users/<int:user_id>', methods=['GET', 'PUT', 'DELETE'])
def api_user_detail(user_id):
    if request.method == 'GET':
        user = get_user_by_id(user_id)
        if not user:
            return jsonify(ok=False, message='Usuário não encontrado.'), 404
        return jsonify(ok=True, user=public_user(user))

    _, error = require_current_user(user_id)
    if error:
        return error

    if request.method == 'DELETE':
        ok, message = delete_user(user_id)
        if not ok:
            return jsonify(ok=False, message=message), 404
        if str(session.get('user_id')) == str(user_id):
            session.clear()
        return jsonify(ok=True, message=message)

    data = request.get_json() or request.form
    ok, result = update_user(user_id, data)
    if not ok:
        return jsonify(ok=False, message=result), 400
    return jsonify(ok=True, user=public_user(result))


@app.route('/api/reset-requests', methods=['GET'])
def api_reset_requests():
    user, error = require_admin()
    if error:
        return error
    return jsonify(ok=True, requests=list_reset_requests())


@app.route('/api/reset-requests/<path:email>/approve', methods=['POST'])
def api_reset_request_approve(email):
    user, error = require_admin()
    if error:
        return error
    ok, message = approve_reset_request(email)
    if not ok:
        return jsonify(ok=False, message=message), 404
    return jsonify(ok=True, message=message)


@app.route('/api/reset-requests/<path:email>/reject', methods=['POST'])
def api_reset_request_reject(email):
    user, error = require_admin()
    if error:
        return error
    ok, message = reject_reset_request(email)
    if not ok:
        return jsonify(ok=False, message=message), 404
    return jsonify(ok=True, message=message)


@app.route('/api/users/<int:user_id>/click-whatsapp', methods=['POST'])
def api_click_whatsapp(user_id):
    ok, message = increment_whatsapp_clicks(user_id)
    if not ok:
        return jsonify(ok=False, message=message), 404
    return jsonify(ok=True, message=message)


@app.route('/api/admin/reset-seed', methods=['POST'])
def api_admin_reset_seed():
    user, error = require_admin()
    if error:
        return error
    reset_seed()
    ensure_seed_data()
    return jsonify(ok=True)

# Rotas públicas
@app.route("/")
def index():  # pragma: no cover
    return render_page("pages/index.html")


@app.route("/homepage")
def homepage():  # pragma: no cover
    return render_page("pages/index.html")


@app.route("/login")
def login():  # pragma: no cover
    return render_page("pages/login.html")


@app.route("/cadastro")
def cadastro():  # pragma: no cover
    return render_page("pages/cadastro.html")


@app.route("/signup-client")
def signup_client():  # pragma: no cover
    return render_page("pages/signup_client.html")


@app.route("/signup-fotografo")
def signup_fotografo():  # pragma: no cover
    return render_page("pages/signup_fotografo.html")


@app.route("/sobrenos")
def sobrenos():  # pragma: no cover
    return render_page("pages/sobrenos.html")


# Rotas de área logada / painel
@app.route("/admin")
def admin():  # pragma: no cover
    return render_page("pages/admin.html")


@app.route("/clientelogado")  
def clientelogado():  # pragma: no cover
    return render_page("pages/clientelogado.html")


@app.route("/fotografologado")
def fotografologado():  # pragma: no cover
    return render_page("pages/fotografologado.html")


@app.route("/busca")
def busca():  # pragma: no cover
    return render_page("pages/busca.html")


@app.route("/perfil-publico")
def perfil_publico():  # pragma: no cover
    return render_page("pages/perfil_publico.html")


@app.route("/perfil-cliente")
def perfil_cliente():  # pragma: no cover
    return render_page("pages/perfil_cliente.html")


@app.route("/perfil-prof")
def perfil_prof():  # pragma: no cover
    return render_page("pages/perfil_prof.html")


@app.route("/editar-perfil")
def editar_perfil():  # pragma: no cover
    return render_page("pages/editar_perfil.html")