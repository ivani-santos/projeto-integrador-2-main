<h1 id="readme-top"> Projeto Integrador em Computação I</h1>

<details>
  <summary><b>Conteúdo</b></summary>
  <ol>
    <li>
      <a href="#about-the-project">Sobre o Projeto Integrador</a>
      <ul>
        <li><a href="#methodology">Metodologia</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Iniciando o Projeto</a>
      <ul>
        <li><a href="#prerequisites">Pré-requisitos</a></li>
        <li><a href="#installation">Instalação</a></li>
      </ul>
    </li>
    <li><a href="#contributing">Contribuições</a>
    <ul>
        <li><a href="#how-do-it">Como Fazer</a></li>
      </ul>
    </li>
    <li><a href="#license">Licença</a></li>
  </ol>
</details>

<h2 id="about-the-project"><p align="center">Sobre o Projeto Integrador</p></h2>

Trata-se de uma atividade curricular obrigatória, consiste na resolução de um problema real contextualizado na profissão em que o curso de Bacharelado em Tecnologia da Informação está inserido. Em grupo, tivemos que delimitar um problema a partir do tema norteador da disciplina de Computação I, propondo uma solução aplicável e usando os conhecimentos estudados nas disciplinas cursadas até o momento.

<b>Tema norteador:</b> tuioiutr

<b>Tema escolhido pelo grupo com base no tema norteador da Univesp:</b> wertuioiutui

<b>Título:</b> FOTECTA - Como conectar fotógrafos com novos clientes

<b>Orientadora:</b> qwertuio

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

## Licença

Este projeto foi desenvolvido para fins acadêmicos e de demonstração.
