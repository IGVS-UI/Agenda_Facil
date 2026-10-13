# Agenda Fácil — Hierarquia de login e rotas

Documento de design. Decide **como cada perfil (cliente / profissional) enxerga só as suas páginas** e como isso evolui de mock para Firebase Auth + Node/Express + MySQL, sem React.

## 1. Requisitos

**Funcionais**
- Dois perfis, com páginas diferentes. O cliente só vê as páginas de cliente; o profissional só as de profissional.
- Cliente: serviços perto dele (busca por localização) e meus agendamentos.
- Profissional: seus serviços (cadastrar, editar, desativar), agendamentos (dashboard do dia) e área do profissional (disponibilidade e dados).
- Páginas públicas: início, login e cadastro.

**Não funcionais / restrições**
- HTML + CSS + JS + Bootstrap (sem React). Projeto acadêmico: simples de explicar.
- Autenticação no Firebase Authentication. Dados no MySQL, via API Node/Express. O navegador nunca fala com o MySQL.
- Hoje: mock (sessão simulada). Trocar por Firebase depois sem reescrever as páginas.

## 2. Princípio central

> **Esconder páginas no front-end é conforto (UX). Proteger dados é responsabilidade do back-end.**

Qualquer pessoa pode abrir o DevTools e pular o guarda do front. Por isso há duas camadas:

| Camada | O que faz | Quem garante |
|---|---|---|
| Front-end (guarda de página + menu) | Redireciona e mostra só os links do perfil | `authService.js` |
| Back-end (middleware da API) | Recusa dados de outro perfil/usuário (401/403) | Express + Firebase Admin |

## 3. Visão geral

```
 Navegador (HTML+CSS+JS)
   |  1. login/cadastro               2. chamadas à API com o token
   v                                  v
 Firebase Auth --ID token-->  Node + Express  --SQL-->  MySQL
   (quem é você)              middleware: verifica token,   (usuario, perfil,
                              descobre o perfil, autoriza    servico, agendamento)
```

- **Firebase Auth** diz *quem* é o usuário (uid + token).
- **MySQL** guarda o *perfil* (`cliente` | `profissional`) ligado ao `firebase_uid`. É a fonte da verdade.
- **API** a cada requisição: verifica o token (`verifyIdToken`), busca o perfil e aplica as regras.

## 4. Matriz de acesso

| Página | Público | Cliente | Profissional |
|---|:-:|:-:|:-:|
| index, login, cadastro | ✔ | ✔ | ✔ |
| servicos (buscar por localização) | | ✔ | |
| meus agendamentos | | ✔ | |
| servicos do profissional (cadastrar/editar) | | | ✔ |
| agendamentos (dashboard do dia) | | | ✔ |
| área do profissional (disponibilidade, dados) | | | ✔ |

Quem tenta abrir uma página que não é do seu perfil vai para a **home do próprio perfil** (cliente → serviços; profissional → agendamentos). Sem login, vai para o login.

## 5. Front-end: o que construir

**5.1 Um módulo de autenticação, no mesmo padrão do `apiService`**

`js/authService.js` é o único lugar que sabe se a sessão é mock ou Firebase (`AUTH_MODO = "mock" | "firebase"`).

```
authService.entrar(email, senha)       -> usuário { uid, perfil, nome }
authService.entrarComGoogle()
authService.cadastrar(dados, perfil)
authService.sair()
authService.usuarioAtual()             -> usuário | null
authService.exigirPerfil("cliente")    -> o guarda
authService.homeDoPerfil(perfil)
```

Hoje existe uma versão informal disso em `prototype-comum.js` (`PC.sessao`, `PC.exigirPerfil`). Ela vira o `authService` no modo mock.

**5.2 O guarda sem lista para manter**

Cada página declara o que exige, e o guarda lê:

```html
<body data-perfil="cliente">          <!-- ou "profissional"; sem atributo = pública -->
<script src="../js/authService.js"></script>
```

- Se a sessão não bate com `data-perfil`, redireciona antes de mostrar a página (esconder o `<body>` até o guarda liberar evita o "flash" do conteúdo).
- Uma tabela de rotas (`rotas.js`) guarda só os links de cada perfil; a **navbar é desenhada pelo JS conforme o perfil**. Assim o cliente nem vê "Área do profissional".

**5.3 Estrutura de pastas recomendada** (troca simples dos nomes `_usuario` / `_profissional`):

```
Pages/
  index.html  autenticacao/login.html  autenticacao/cadastro.html     (públicas)
  cliente/       servicos.html  meus-agendamentos.html
  profissional/  servicos.html  agendamentos.html  area.html
```

A pasta já diz o perfil, e as páginas de nomes iguais (`servicos.html`) não se confundem entre os perfis.

## 6. Fluxos

**Cadastro**
```
formulário (perfil + dados)
  -> Firebase: createUser(email, senha)        -> uid + token
  -> POST /api/usuarios  { perfil, dados }     (com token)
       API grava usuario(firebase_uid, perfil) e, se profissional, o local/endereço
  -> redireciona para a home do perfil
```

**Login**
```
Firebase: signIn(...)  -> token
  -> GET /api/me       -> { perfil, nome }      (perfil vem do MySQL, não da tela)
  -> authService guarda o usuário e vai para a home do perfil
```

**O seletor "Sou cliente / Sou profissional" na tela de login é só UX.** O perfil que vale é o que a API devolve. Se a pessoa escolher o perfil errado, mostra "Esta conta é de cliente" em vez de entrar.

## 7. Regras de autorização na API (futuro)

| Endpoint | Quem | Regra |
|---|---|---|
| `GET /api/servicos`, `/api/profissionais` | cliente | lista conforme a localização enviada |
| `POST/PUT/DELETE /api/servicos` | profissional | só os serviços dele (`profissional_id` do token) |
| `GET /api/agendamentos` | ambos | cliente: só os dele; profissional: só os dele |
| `POST /api/agendamentos` | cliente | valida conflito de horário no servidor |
| `PATCH /api/agendamentos/:id/status` | profissional: confirmar, concluir, cancelar. cliente: só cancelar o próprio | transições válidas (PENDENTE→CONFIRMADO→CONCLUÍDO; →CANCELADO) |
| `PUT /api/profissionais/:id/disponibilidade` | profissional | só a própria |

Middleware em duas peças: `autenticar` (token válido → `req.usuario`) e `exigirPerfil("cliente" | "profissional")`. Além do perfil, **cada consulta filtra pelo dono** (`WHERE cliente_id = ?`), para um cliente nunca ler o agendamento de outro mudando o `:id` na URL.

## 8. Trade-offs e decisões

| Decisão | Escolhida | Alternativa | Por quê |
|---|---|---|---|
| Onde fica o perfil | MySQL (`usuario.perfil`) | Custom claims do Firebase | Uma fonte de verdade, fácil de explicar e de consultar. Claims podem entrar depois como cache. |
| Uma ou duas telas de login | Uma tela, perfil vindo da API | Duas telas separadas | Menos duplicação; mesma autenticação. O seletor é só conveniência. |
| Guarda | `data-perfil` por página | Lista central de rotas | Nada para esquecer ao criar página nova. |
| Pastas | Uma por perfil | Sufixos no nome do arquivo | O guarda e o menu ficam óbvios. |
| Firebase no navegador | Módulos ES por CDN do Firebase | `npm` + empacotador | Sem build. O `firebase.js` atual usa `import ... from "firebase/app"`, que **não roda direto no navegador** sem empacotador. |

## 9. Passos de migração

1. **Agora (mock):** extrair `authService.js` (modo mock) de `prototype-comum.js`; `data-perfil` nas páginas; navbar por perfil.
2. **Páginas definitivas:** escolher as variantes e escrever as páginas finais nas pastas por perfil.
3. **Back-end:** Express com `autenticar`/`exigirPerfil` e os endpoints da seção 7 (com dados em memória primeiro).
4. **MySQL:** tabelas `usuario` (firebase_uid, perfil), `profissional` (endereço, latitude, longitude), `servico`, `disponibilidade`, `agendamento`.
5. **Integração:** `AUTH_MODO = "firebase"` e `API_MODO = "http"`; o front não muda.

## 10. O que revisar quando o sistema crescer
- Papéis além de dois (ex.: administrador).
- Mesma pessoa sendo cliente **e** profissional (hoje: contas separadas).
- Recuperação de senha e verificação de e-mail.
- Regras de segurança do lado do servidor para limitar tentativas (rate limit).
