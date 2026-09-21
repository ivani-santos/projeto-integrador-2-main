import pytest
from Py.main import app
from Py.sql_store import reset_seed

@pytest.fixture
def client():
    """Configura o cliente de testes e reseta o banco de dados para o estado inicial."""
    app.config['TESTING'] = True
    
    # Reseta a seed para garantir que as contas demo (como cliente@fotecta.com)
    # existam limpas e prontas antes dos testes iniciarem
    reset_seed()
    
    with app.test_client() as client:
        yield client


def test_api_login_sucesso(client):
    """Testa se o login da conta demo de cliente funciona corretamente."""
    response = client.post('/api/login', json={
        'email': 'cliente@fotecta.com',
        'senha': 'cliente123'
    })
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['ok'] is True
    assert data['user']['email'] == 'cliente@fotecta.com'
    assert data['user']['tipo'] == 'cliente'


def test_api_login_falha(client):
    """Testa se tentar logar com credenciais inválidas retorna erro 401."""
    response = client.post('/api/login', json={
        'email': 'cliente@fotecta.com',
        'senha': 'senha_incorreta'
    })
    
    assert response.status_code == 401
    data = response.get_json()
    assert data['ok'] is False
    assert 'Credenciais inválidas' in data['message']


def test_api_register_sucesso(client):
    """Testa o registro de uma nova conta de fotógrafo."""
    response = client.post('/api/register', json={
        'nome': 'Novo Fotógrafo',
        'email': 'novofotografo@fotecta.com',
        'senha': 'senhaforte123',
        'tipo': 'fotografo'
    })
    
    assert response.status_code == 201
    data = response.get_json()
    assert data['ok'] is True
    assert data['user']['email'] == 'novofotografo@fotecta.com'
    assert data['user']['tipo'] == 'fotografo'


def test_api_register_email_duplicado(client):
    """Testa a restrição ao tentar registrar um email que já existe (conta demo admin)."""
    response = client.post('/api/register', json={
        'nome': 'Admin Copia',
        'email': 'admin@fotecta.com',
        'senha': 'outrasenha',
        'tipo': 'cliente'
    })
    
    assert response.status_code == 400
    data = response.get_json()
    assert data['ok'] is False
    assert 'E-mail já cadastrado' in data['message']


def test_api_authenticated_request(client):
    """Testa o acesso a uma rota protegida (favoritos) após realizar o login."""
    # 1. Primeiro fazemos o login (o client guardará o cookie de sessão automaticamente)
    client.post('/api/login', json={
        'email': 'cliente@fotecta.com',
        'senha': 'cliente123'
    })
    
    # 2. Agora fazemos a requisição restrita (O ID 2 pertence ao Cliente Demo)
    response = client.get('/api/users/2/favoritos')
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['ok'] is True
    assert 'favoritos' in data


def test_api_unauthorized_request(client):
    """Testa se acessar uma rota protegida sem estar logado retorna erro 401."""
    response = client.get('/api/users/2/favoritos')
    
    assert response.status_code == 401


def test_api_update_profile_photo(client):
    """Testa a atualização do perfil do usuário enviando uma URL ou Base64 de foto."""
    # 1. Realiza o login como fotógrafo para iniciar a sessão (ID = 3)
    client.post('/api/login', json={
        'email': 'fotografo@fotecta.com',
        'senha': 'foto123'
    })
    
    # 2. Envia um PUT para a rota de atualização com uma "foto" simulada em Base64
    fake_base64_image = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD..."
    response = client.put('/api/users/3', json={
        'foto': fake_base64_image
    })
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['ok'] is True
    assert data['user']['foto'] == fake_base64_image


def test_api_delete_user_admin_permission(client):
    """Testa as permissões ao tentar deletar um usuário."""
    # 1. Loga como Cliente (Não-Admin)
    client.post('/api/login', json={
        'email': 'cliente@fotecta.com',
        'senha': 'cliente123'
    })
    
    # Tenta apagar a conta do fotógrafo (ID = 3) e deve ter o acesso negado (403)
    response_forbidden = client.delete('/api/users/3')
    assert response_forbidden.status_code == 403
    
    # 2. Faz logout da conta do cliente e loga como Admin
    client.post('/logout')
    client.post('/api/login', json={
        'email': 'admin@fotecta.com',
        'senha': 'admin123'
    })
    
    # 3. Como Admin, tenta apagar a conta do fotógrafo novamente, deve ter sucesso
    response_success = client.delete('/api/users/3')
    assert response_success.status_code == 200


def test_api_delete_own_account(client):
    """Testa se um usuário (fotógrafo ou cliente) consegue excluir a própria conta."""
    # 1. Loga como Cliente (ID = 2)
    client.post('/api/login', json={'email': 'cliente@fotecta.com', 'senha': 'cliente123'})
    
    # 2. Usuário logado tenta excluir a si mesmo
    response_delete = client.delete('/api/users/2')
    assert response_delete.status_code == 200
    assert response_delete.get_json()['ok'] is True
    
    # 3. Confirma que a conta não existe mais no banco (Erro 404)
    response_get = client.get('/api/users/2')
    assert response_get.status_code == 404