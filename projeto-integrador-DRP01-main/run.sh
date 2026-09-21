#!/usr/bin/env bash
# Script simples para rodar a aplicação localmente (macOS/Linux)
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d "venv" ]; then
  echo "Criando ambiente virtual..."
  python3 -m venv venv
fi
# Ativa venv
source venv/bin/activate
# Instala dependências se necessário
pip install --upgrade pip
pip install -r requirements.txt
# Roda a aplicação como pacote para preservar imports relativos
python -m Py.main
