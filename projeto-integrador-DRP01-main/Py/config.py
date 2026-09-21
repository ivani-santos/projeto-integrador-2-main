import os


class Config:
    """Configurações simples e didáticas para o app.

    - Em produção, defina `SECRET_KEY` como variável de ambiente forte.
    - Aqui usamos um fallback para facilitar testes locais.
    """

    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-change-me')
    # Outras configurações didáticas podem ir aqui (DB_URI, DEBUG flags, etc.)
