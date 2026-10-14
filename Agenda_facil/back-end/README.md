# Agenda Fácil — API (Node.js + Express)

API REST do Agenda Fácil. Funciona com **dados em memória** (rápido, para testar) ou com o **MySQL** (dados de verdade). A próxima etapa é o login real (Firebase Authentication).

## Como rodar

```bash
cd Agenda_facil/back-end/src
npm install          # só na primeira vez
npm start            # sobe em http://localhost:3000/api   (npm run dev reinicia ao salvar)
npm test             # roda os testes automáticos das regras
```

Requer Node 22 ou mais novo. Sem `.env`, a API roda em memória.

## Usando o MySQL

1. Crie o banco rodando `database/criar_banco.sql` no Workbench (e, se quiser dados de teste, `database/dados_exemplo.sql`).
2. Copie `src/.env.example` para `src/.env` e preencha:
   ```
   DADOS_MODO=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=sua_senha_do_mysql
   DB_NAME=Agenda_Facil
   ```
   O `.env` não vai para o GitHub (está no `.gitignore`): é lá que ficam as senhas.
3. `npm start`. Se o banco não responder, a API avisa o motivo e não sobe.

Os testes (`npm test`) também rodam no MySQL, mas **apagam e recarregam os dados** do banco usado. Por isso exigem um banco separado cujo nome termina em `_teste`
(rode o `criar_banco.sql` trocando `Agenda_Facil` por `Agenda_Facil_teste` e use `DB_NAME=Agenda_Facil_teste`). Em qualquer outro banco, a limpeza se recusa a rodar.

Para o front-end falar com a API (em vez do mock), abra qualquer página com `?api=http`, por exemplo
`servicos_usuario.html?api=http` (volte ao mock com `?api=mock`).

## Estrutura (`src/`)

| Pasta | Papel |
|---|---|
| `routes/` | Lista de rotas e quem pode acessar cada uma |
| `controllers/` | Traduzem HTTP ⇄ serviço (leem a requisição e devolvem JSON) |
| `services/` | **Regras de negócio** (conflito de horário, status, permissões, distância) |
| `models/` | **Único lugar que acessa os dados.** `memoria.js` hoje; `mysql.js` depois, com as mesmas funções |
| `middlewares/` | Identificação do usuário e tratamento de erros |
| `config/` | Leitura do `.env` |
| `testes/` | Testes automáticos (`node:test`) |

## Quem está chamando (modo de desenvolvimento)

Com `AUTH_MODO=fake`, o cabeçalho `X-Usuario-Id` diz o usuário (id da tabela `usuario`): 1 a 5 são clientes, 6 a 9 são profissionais.
Na integração, vira `Authorization: Bearer <token do Firebase>`, e nada nas regras muda: elas usam só `req.usuario`.

## Rotas

| Método e rota | Quem acessa | O que faz |
|---|---|---|
| `GET /api/saude` | público | Confere se a API está no ar |
| `GET /api/servicos` | público | Serviços ativos (com `popular`) |
| `GET /api/servicos?apenasAtivos=false` | profissional | Todos os serviços do próprio profissional, inclusive desativados |
| `GET /api/profissionais?servicoId=&origem=` | público | Locais ordenados por distância (`origem=centro` ou `latitude=`&`longitude=`) |
| `GET /api/origens` | público | Localizações de exemplo para testar sem GPS |
| `GET /api/horarios-disponiveis?profissionalId=&data=AAAA-MM-DD` | público | Horários do dia: `disponivel`, `ocupado` ou `indisponivel` |
| `GET /api/me` | logado | Quem sou eu e meu perfil |
| `GET /api/agendamentos?status=&data=` | logado | Só os agendamentos do usuário (cliente ou profissional) |
| `POST /api/agendamentos` | cliente | Cria agendamento `PENDENTE` (recusa horário ocupado: `409`) |
| `PUT /api/agendamentos/:id` | cliente | Reagenda (dia e hora) |
| `PATCH /api/agendamentos/:id/status` | logado | Muda o status: profissional faz qualquer transição válida; cliente só cancela |
| `DELETE /api/agendamentos/:id` | cliente | Exclui um agendamento ainda pendente |
| `POST /api/servicos`, `PUT /api/servicos/:id` | profissional | Cria, edita e ativa/desativa os próprios serviços |
| `GET/PUT /api/profissionais/:id/disponibilidade` | profissional | Agenda semanal e bloqueios (só a própria) |

Erros vêm como JSON `{ "mensagem": "..." }` com o código HTTP adequado (400, 401, 403, 404, 409).

## Regras importantes (todas no servidor)

- O cliente de um agendamento é **sempre o usuário logado**; ids enviados no corpo são ignorados.
- Só se agenda um horário `disponivel`: no dia de atendimento do profissional, não bloqueado, não passado e sem outro agendamento ativo.
- O serviço precisa ser do profissional escolhido e estar ativo.
- Status: `PENDENTE → CONFIRMADO → CONCLUIDO`, ou `→ CANCELADO` a partir de pendente/confirmado.
- Cada pessoa só vê e altera o que é seu (profissional: seus clientes e serviços; cliente: seus agendamentos).

## Observações do MySQL

- Todas as consultas usam parâmetros (`?`), nunca texto montado: isso evita SQL injection.
- A trava final contra horário duplicado é do banco (índice único em `agendamento`): se dois clientes reservarem o mesmo horário ao mesmo tempo, só um entra e o outro recebe `409`.
- A avaliação (nota) dos locais ainda não existe no banco; a API devolve `avaliacao: null` e o front não mostra a nota.

## Próxima etapa

**Firebase Authentication:** implementar `AUTH_MODO=firebase` em `middlewares/autenticacao.js` (verificar o token, procurar o `firebase_uid` em `usuario` e montar o `req.usuario`). Nada nas regras de negócio muda.
