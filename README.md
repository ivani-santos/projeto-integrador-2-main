# FOTECTA

Versão em JavaScript do projeto FOTECTA.

## Visão geral

O FOTECTA é uma plataforma para conectar clientes e fotógrafos, com:

- busca por profissionais;
- autenticação de usuários;
- painel específico para cliente, fotógrafo e administrador;
- favoritos, perfis públicos e estrutura de cadastro;
- banco SQLite local para armazenamento persistente.

## Stack atual

- Node.js
- Express
- JavaScript no frontend e no backend
- SQLite via sql.js
- HTML + CSS puro

## Pré-requisitos

- Node.js 18+ ou superior
- npm
- VS Code ou outro editor de sua preferência

## Como rodar

No diretório do projeto:

```bash
npm install
npm start
```

A aplicação fica disponível em:

```text
http://localhost:3000
```

## Estrutura principal

- `server.js`: servidor Express e rotas da aplicação
- `public/`: arquivos HTML, CSS e JavaScript do frontend
- `instance/`: banco SQLite gerado localmente
- `tests/`: testes de API e autenticação

## Contas de demonstração

Use estes acessos para testar as telas:

- Admin: `admin@fotecta.com` / `admin123`
- Cliente: `cliente@fotecta.com` / `cliente123`
- Fotógrafo: `fotografo@fotecta.com` / `foto123`

## Banco de dados

Os dados ficam armazenados em SQLite localmente no projeto.

Arquivos relevantes:

- `instance/fotecta.sqlite3`
- `Banco de Dados/fotecta_schema.sql`

## Funções principais

- Login e cadastro
- Busca de fotógrafos
- Favoritar profissionais
- Dashboard do cliente
- Dashboard do fotógrafo
- Dashboard do admin
- Reset de dados demo

## Como testar

```bash
npm test
```

## Observação

Esta versão foi migrada para JavaScript/Node para manter a mesma proposta do projeto original, com visual e fluxo funcional adaptados para execução local e uso didático.
