<h1 id="readme-top"> Projeto Integrador em Computação II</h1>


<h2 id="about-the-project"><p align="center">Sobre o Projeto Integrador</p></h2>

Trata-se de uma atividade curricular obrigatória, consiste na resolução de um problema real contextualizado na profissão em que o cursos estão inserido. Em grupo, tivemos que delimitar um problema a partir do tema norteador da disciplina de Projeto Integrador em Computação II, propondo uma solução aplicável e usando os conhecimentos estudados nas disciplinas cursadas até o momento.

<b>Tema norteador:</b> Desenvolver um software com framework web que utilize banco de dados, inclua script web (Javascript), nuvem, uso de API, acessibilidade, controle de versão e testes. Opcionalmente, incluir análise de dados.

<b>Tema escolhido pelo grupo com base no tema norteador da Univesp:</b> Desenvolvimento de um software com framework web para a divulgação de portfólio de profissionais autônomos do seguimento fotográfico, utilizando banco de dados para o armazenamento de informações, JavaScript como linguagem de programação, API no desenvolvimento, nuvem para armazenamento, acessibilidade na utilização, testes para controle e controle de versão para registro da evolução do grupo.

<b>Título:</b> FOTECTA - Como conectar fotógrafos com novos clientes

<b>Orientadora:</b> Ana Mariele Domingues

<b>Integrantes:</b> Gabriela Sampaio da Silva, Gustavo Santos Lima de Oliveira, Ivani Santos André, Jacqueline Santana Nascimento Benevides, Leonardo Quaresma da Silva, Maria José de Sousa, Otávio Augusto Costa e Victor Gabriel Santos Magalhães

<p align="right"><a href="#readme-top">voltar ao início</a></p>

---

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

No diretório/terminal do projeto:

```bash
cd ".\projeto-integrador-DRP01-main"
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

## Acessibilidade

Todas as páginas incluem controles para aumentar, diminuir e restaurar o tamanho do texto, ativar o alto contraste e pular diretamente para o conteúdo principal. As preferências de texto e contraste são salvas no navegador. A interface também oferece foco visível para navegação por teclado e avisos compatíveis com leitores de tela.

## Como testar

```bash
npm test
```

## Observação

Esta versão foi migrada para JavaScript/Node para manter a mesma proposta do projeto original, com visual e fluxo funcional adaptados para execução local e uso didático.

## Licença

Este projeto foi desenvolvido para fins acadêmicos e de demonstração.
