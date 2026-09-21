import pytest
from flask import abort
from Py.main import app

@pytest.fixture
def client():
    """Configura o client de testes do Flask e injeta rotas para forçar erros."""
    app.config['TESTING'] = True
    
    # Rotas temporárias apenas para disparar os error handlers durante os testes
    @app.route('/test-401')
    def test_401():
        abort(401)

    @app.route('/test-403')
    def test_403():
        abort(403)

    @app.route('/test-500')
    def test_500():
        abort(500)
        
    with app.test_client() as client:
        yield client


def test_404_not_found(client):
    response = client.get('/rota-que-nao-existe-123')
    assert response.status_code == 404
    assert b'404' in response.data
    assert 'Página não encontrada'.encode('utf-8') in response.data


def test_401_unauthorized(client):
    response = client.get('/test-401')
    assert response.status_code == 401
    assert b'401' in response.data
    assert 'Você precisa estar logado'.encode('utf-8') in response.data

def test_403_forbidden(client):
    response = client.get('/test-403')
    assert response.status_code == 403
    assert b'403' in response.data
    assert 'Acesso Negado'.encode('utf-8') in response.data

def test_500_internal_error(client):
    response = client.get('/test-500')
    assert response.status_code == 500
    assert b'500' in response.data
    assert 'Erro Interno do Servidor'.encode('utf-8') in response.data