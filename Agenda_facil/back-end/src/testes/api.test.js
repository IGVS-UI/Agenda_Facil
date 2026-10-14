/*
 * Testes automáticos das regras da API (rodam com:  npm test).
 * Sobem a API numa porta livre, usam os dados de exemplo em memória e chamam com fetch.
 * Usuários de exemplo: 1 = cliente Igor, 2 = cliente Ana, 6 = profissional João (profissional 1),
 * 7 = profissional Marina (profissional 2).
 */
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const modelo = require("../models");

let servidor, base;
before(async () => {
    await new Promise((ok) => { servidor = app.listen(0, ok); });
    base = `http://127.0.0.1:${servidor.address().port}/api`;
});
after(async () => { servidor.close(); await modelo.encerrar(); });
beforeEach(() => modelo.restaurar());

const IGOR = 1, ANA = 2, JOAO = 6, MARINA = 7;
// usuario: id do banco (X-Usuario-Id). token: "teste:<uid>:<email>:<nome>" (alguém recém-criado no Firebase)
async function chamar(metodo, caminho, { usuario, token, corpo } = {}) {
    const resposta = await fetch(base + caminho, {
        method: metodo,
        headers: {
            "Content-Type": "application/json",
            ...(usuario ? { "X-Usuario-Id": String(usuario) } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: corpo ? JSON.stringify(corpo) : undefined
    });
    const texto = await resposta.text();
    return { status: resposta.status, dados: texto ? JSON.parse(texto) : null };
}

const pad = (n) => String(n).padStart(2, "0");
const dataEm = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// próxima data (a partir de amanhã) em que o João atende na quarta-feira (dia 3): horário 09:00 livre
const proximaQuarta = () => { for (let i = 1; i < 15; i++) { const d = new Date(); d.setDate(d.getDate() + i); if (d.getDay() === 3) return dataEm(i); } };

/* ---------- catálogo público ---------- */

test("lista os serviços ativos, com 4 populares", async () => {
    const { status, dados } = await chamar("GET", "/servicos");
    assert.equal(status, 200);
    assert.equal(dados.length, 7);
    assert.equal(dados.filter((s) => s.popular).length, 4);
});

test("serviço desativado não conta entre os populares (continuam 4 ativos)", async () => {
    const antes = (await chamar("GET", "/servicos")).dados.filter((s) => s.popular);
    await chamar("PUT", `/servicos/${antes[0].id}`, { usuario: antes[0].profissionalId === 1 ? JOAO : MARINA, corpo: { ativo: false } });
    const depois = (await chamar("GET", "/servicos")).dados.filter((s) => s.popular);
    assert.equal(depois.length, 4);
    assert.ok(depois.every((s) => s.ativo));
});

test("profissionais vêm ordenados do mais próximo para o mais distante", async () => {
    const { dados } = await chamar("GET", "/profissionais?origem=centro");
    assert.equal(dados[0].local, "Barbearia do João");
    assert.ok(dados.every((p, i) => i === 0 || dados[i - 1].distanciaKm <= p.distanciaKm));
    const jardim = (await chamar("GET", "/profissionais?origem=jardim")).dados;
    assert.equal(jardim[0].local, "Studio Marina Alves");
});

test("aceita latitude/longitude e recusa valores inválidos", async () => {
    assert.equal((await chamar("GET", "/profissionais?latitude=-23.56&longitude=-46.65")).status, 200);
    assert.equal((await chamar("GET", "/profissionais?latitude=abc&longitude=1")).status, 400);
    assert.equal((await chamar("GET", "/profissionais?origem=marte")).status, 400);
});

test("horários: ocupado, livre e data inválida", async () => {
    const amanha = dataEm(1);
    const { dados } = await chamar("GET", `/horarios-disponiveis?profissionalId=1&data=${amanha}`);
    if (new Date(`${amanha}T00:00:00`).getDay() >= 1 && new Date(`${amanha}T00:00:00`).getDay() <= 6) {
        assert.equal(dados.find((h) => h.hora === "10:00").estado, "ocupado");  // agendamento confirmado de exemplo
    }
    assert.equal((await chamar("GET", "/horarios-disponiveis?profissionalId=1&data=2026-02-30")).status, 400);
    assert.equal((await chamar("GET", "/horarios-disponiveis?profissionalId=99&data=" + amanha)).status, 404);
});

/* ---------- agendar ---------- */

test("só cliente logado agenda; o cliente é quem está logado (corpo é ignorado)", async () => {
    const data = proximaQuarta();
    const corpo = { servicoId: 1, profissionalId: 1, data, hora: "09:00", usuarioId: 5, clienteId: 5 };
    assert.equal((await chamar("POST", "/agendamentos", { corpo })).status, 401);
    assert.equal((await chamar("POST", "/agendamentos", { usuario: JOAO, corpo })).status, 403);
    const { status, dados } = await chamar("POST", "/agendamentos", { usuario: IGOR, corpo });
    assert.equal(status, 201);
    assert.equal(dados.status, "PENDENTE");
    assert.equal(dados.clienteId, IGOR);
});

test("não deixa agendar o mesmo horário duas vezes; cancelar libera o horário", async () => {
    const data = proximaQuarta();
    const corpo = { servicoId: 1, profissionalId: 1, data, hora: "09:00" };
    const primeiro = await chamar("POST", "/agendamentos", { usuario: IGOR, corpo });
    assert.equal(primeiro.status, 201);
    assert.equal((await chamar("POST", "/agendamentos", { usuario: ANA, corpo })).status, 409);

    await chamar("PATCH", `/agendamentos/${primeiro.dados.id}/status`, { usuario: IGOR, corpo: { status: "CANCELADO" } });
    assert.equal((await chamar("POST", "/agendamentos", { usuario: ANA, corpo })).status, 201);
});

test("recusa serviço de outro profissional, horário bloqueado, passado e dados ruins", async () => {
    const data = proximaQuarta();
    assert.equal((await chamar("POST", "/agendamentos", { usuario: IGOR, corpo: { servicoId: 3, profissionalId: 1, data, hora: "09:00" } })).status, 400);   // serviço 3 é da Marina
    assert.equal((await chamar("POST", "/agendamentos", { usuario: IGOR, corpo: { servicoId: 1, profissionalId: 1, data, hora: "03:00" } })).status, 409);   // fora do horário de atendimento
    assert.equal((await chamar("POST", "/agendamentos", { usuario: IGOR, corpo: { servicoId: 1, profissionalId: 1, data: dataEm(-3), hora: "09:00" } })).status, 409);   // passado
    assert.equal((await chamar("POST", "/agendamentos", { usuario: IGOR, corpo: { servicoId: 1, profissionalId: 1, data: "ontem", hora: "09:00" } })).status, 400);
    assert.equal((await chamar("POST", "/agendamentos", { usuario: IGOR, corpo: {} })).status, 400);
});

/* ---------- quem vê o quê ---------- */

test("cada um vê só os próprios agendamentos", async () => {
    const igor = (await chamar("GET", "/agendamentos", { usuario: IGOR })).dados;
    assert.ok(igor.length > 0 && igor.every((a) => a.clienteId === IGOR));
    const joao = (await chamar("GET", "/agendamentos", { usuario: JOAO })).dados;
    assert.ok(joao.length > 0 && joao.every((a) => a.profissionalId === 1));
    assert.ok(joao[0].cliente.telefone);                          // o profissional vê o contato do cliente
    assert.equal((await chamar("GET", "/agendamentos")).status, 401);
    const marina = (await chamar("GET", "/agendamentos", { usuario: MARINA })).dados;
    assert.ok(marina.every((a) => a.profissionalId === 2));
});

test("filtros de status e data", async () => {
    const hoje = dataEm(0);
    const lista = (await chamar("GET", `/agendamentos?data=${hoje}&status=CONFIRMADO`, { usuario: JOAO })).dados;
    assert.equal(lista.length, 2);
    assert.equal((await chamar("GET", "/agendamentos?status=XYZ", { usuario: JOAO })).status, 400);
});

/* ---------- status ---------- */

test("profissional confirma e conclui; cliente só cancela; transições inválidas são recusadas", async () => {
    const pendente = (await chamar("GET", `/agendamentos?data=${dataEm(0)}&status=PENDENTE`, { usuario: JOAO })).dados[0];
    // o cliente dono (Julia, usuário 5) não pode confirmar o próprio
    assert.equal((await chamar("PATCH", `/agendamentos/${pendente.id}/status`, { usuario: 5, corpo: { status: "CONFIRMADO" } })).status, 403);
    // outro profissional não mexe no agendamento do João
    assert.equal((await chamar("PATCH", `/agendamentos/${pendente.id}/status`, { usuario: MARINA, corpo: { status: "CONFIRMADO" } })).status, 403);
    // o João confirma, conclui, e depois não volta atrás
    assert.equal((await chamar("PATCH", `/agendamentos/${pendente.id}/status`, { usuario: JOAO, corpo: { status: "CONFIRMADO" } })).dados.status, "CONFIRMADO");
    assert.equal((await chamar("PATCH", `/agendamentos/${pendente.id}/status`, { usuario: JOAO, corpo: { status: "CONCLUIDO" } })).dados.status, "CONCLUIDO");
    assert.equal((await chamar("PATCH", `/agendamentos/${pendente.id}/status`, { usuario: JOAO, corpo: { status: "CONFIRMADO" } })).status, 400);
    assert.equal((await chamar("PATCH", `/agendamentos/${pendente.id}/status`, { usuario: JOAO, corpo: { status: "INVENTADO" } })).status, 400);
    // um cliente que não é dono não consegue nem cancelar
    const doIgor = (await chamar("GET", "/agendamentos?status=CONFIRMADO", { usuario: IGOR })).dados[0];
    assert.equal((await chamar("PATCH", `/agendamentos/${doIgor.id}/status`, { usuario: ANA, corpo: { status: "CANCELADO" } })).status, 403);
    assert.equal((await chamar("PATCH", `/agendamentos/${doIgor.id}/status`, { usuario: IGOR, corpo: { status: "CANCELADO" } })).dados.status, "CANCELADO");
});

test("reagendar e excluir", async () => {
    const data = proximaQuarta();
    const criado = (await chamar("POST", "/agendamentos", { usuario: IGOR, corpo: { servicoId: 1, profissionalId: 1, data, hora: "09:00" } })).dados;
    const novo = await chamar("PUT", `/agendamentos/${criado.id}`, { usuario: IGOR, corpo: { data, hora: "15:00" } });
    assert.equal(novo.dados.hora, "15:00");
    assert.equal((await chamar("PUT", `/agendamentos/${criado.id}`, { usuario: IGOR, corpo: { data, hora: "15:00" } })).status, 200);   // o próprio horário não conflita consigo
    assert.equal((await chamar("PUT", `/agendamentos/${criado.id}`, { usuario: ANA, corpo: { data, hora: "16:00" } })).status, 403);
    assert.equal((await chamar("DELETE", `/agendamentos/${criado.id}`, { usuario: ANA })).status, 403);
    assert.equal((await chamar("DELETE", `/agendamentos/${criado.id}`, { usuario: IGOR })).status, 204);
    assert.equal((await chamar("PUT", `/agendamentos/${criado.id}`, { usuario: IGOR, corpo: { data, hora: "16:00" } })).status, 404);
});

/* ---------- serviços do profissional ---------- */

test("profissional cria, edita e desativa os próprios serviços; os outros não podem", async () => {
    const corpo = { nome: "Hidratação", categoria: "Beleza", descricao: "Tratamento profundo.", duracaoMin: 40, preco: 80, profissionalId: 3 };
    assert.equal((await chamar("POST", "/servicos", { usuario: IGOR, corpo })).status, 403);
    assert.equal((await chamar("POST", "/servicos", { corpo })).status, 401);
    assert.equal((await chamar("POST", "/servicos", { usuario: JOAO, corpo: { ...corpo, preco: -5 } })).status, 400);

    const criado = await chamar("POST", "/servicos", { usuario: JOAO, corpo });
    assert.equal(criado.status, 201);
    assert.equal(criado.dados.profissionalId, 1);                     // sempre do profissional logado
    const id = criado.dados.id;

    assert.equal((await chamar("PUT", `/servicos/${id}`, { usuario: MARINA, corpo: { preco: 1 } })).status, 403);
    assert.equal((await chamar("PUT", `/servicos/${id}`, { usuario: JOAO, corpo: { preco: 90 } })).dados.preco, 90);

    await chamar("PUT", `/servicos/${id}`, { usuario: JOAO, corpo: { ativo: false } });
    assert.ok(!(await chamar("GET", "/servicos")).dados.some((s) => s.id === id));                                  // some do catálogo público
    assert.ok((await chamar("GET", "/servicos?apenasAtivos=false", { usuario: JOAO })).dados.some((s) => s.id === id));   // o dono ainda vê
    assert.equal((await chamar("GET", "/servicos?apenasAtivos=false", { usuario: IGOR })).status, 403);
    assert.equal((await chamar("POST", "/agendamentos", { usuario: IGOR, corpo: { servicoId: id, profissionalId: 1, data: proximaQuarta(), hora: "09:00" } })).status, 404);
});

/* ---------- disponibilidade ---------- */

test("só o dono lê e altera a própria agenda; bloqueio some para o cliente", async () => {
    assert.equal((await chamar("GET", "/profissionais/1/disponibilidade", { usuario: MARINA })).status, 403);
    assert.equal((await chamar("GET", "/profissionais/1/disponibilidade", { usuario: IGOR })).status, 403);
    const agenda = (await chamar("GET", "/profissionais/1/disponibilidade", { usuario: JOAO })).dados;
    assert.deepEqual(agenda.disponibilidade["1"], ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"]);

    assert.equal((await chamar("PUT", "/profissionais/1/disponibilidade", { usuario: JOAO, corpo: { disponibilidade: { 9: ["09:00"] }, bloqueios: [] } })).status, 400);
    assert.equal((await chamar("PUT", "/profissionais/1/disponibilidade", { usuario: JOAO, corpo: { disponibilidade: { 3: ["9h"] }, bloqueios: [] } })).status, 400);

    const data = proximaQuarta();
    const salvo = await chamar("PUT", "/profissionais/1/disponibilidade", {
        usuario: JOAO, corpo: { disponibilidade: { 3: ["10:00", "09:00", "09:00"] }, bloqueios: [{ data, hora: "10:00" }] }
    });
    assert.equal(salvo.status, 200);
    assert.deepEqual(salvo.dados.disponibilidade, { 3: ["09:00", "10:00"] });

    const horarios = (await chamar("GET", `/horarios-disponiveis?profissionalId=1&data=${data}`)).dados;
    assert.deepEqual(horarios, [{ hora: "09:00", estado: "disponivel" }, { hora: "10:00", estado: "indisponivel" }]);
});

/* ---------- geral ---------- */

test("/me, rota inexistente e JSON inválido", async () => {
    assert.equal((await chamar("GET", "/me")).status, 401);
    assert.deepEqual((await chamar("GET", "/me", { usuario: JOAO })).dados, { id: 6, nome: "João Barbosa", perfil: "profissional", profissionalId: 1 });
    assert.equal((await chamar("GET", "/me", { usuario: 999 })).status, 401);
    assert.equal((await chamar("GET", "/nao-existe")).status, 404);
    const ruim = await fetch(`${base}/agendamentos`, { method: "POST", headers: { "Content-Type": "application/json", "X-Usuario-Id": "1" }, body: "{quebrado" });
    assert.equal(ruim.status, 400);
});

/* ---------- cadastro (Firebase) ---------- */

const ENDERECO = { especialidade: "Barbearia", nomeLocal: "Barbearia Nova", cep: "01310-100", logradouro: "Av. Paulista", numero: "1000", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP" };

test("cadastro de cliente: token sem conta -> CADASTRO_INCOMPLETO; depois de cadastrar, entra normalmente", async () => {
    const token = "teste:uid-ana-nova:ana.nova@exemplo.com:Ana Nova";
    assert.equal((await chamar("POST", "/usuarios", { corpo: { perfil: "cliente", nome: "Ana Nova" } })).status, 401);        // sem token

    const antes = await chamar("GET", "/me", { token });
    assert.equal(antes.status, 403);
    assert.equal(antes.dados.codigo, "CADASTRO_INCOMPLETO");

    const criado = await chamar("POST", "/usuarios", { token, corpo: { perfil: "cliente", nome: "Ana Nova", telefone: "(11) 90000-1111", email: "outro@hacker.com" } });
    assert.equal(criado.status, 201);
    assert.equal(criado.dados.perfil, "cliente");

    const depois = await chamar("GET", "/me", { token });
    assert.equal(depois.status, 200);
    assert.equal(depois.dados.nome, "Ana Nova");
    assert.equal((await modelo.usuarioPorId(depois.dados.id)).email, "ana.nova@exemplo.com");     // o e-mail vem do token, não do corpo

    assert.equal((await chamar("POST", "/usuarios", { token, corpo: { perfil: "cliente", nome: "Ana Nova" } })).status, 409);   // já cadastrada
    // a nova cliente já consegue agendar
    const data = proximaQuarta();
    assert.equal((await chamar("POST", "/agendamentos", { token, corpo: { servicoId: 1, profissionalId: 1, data, hora: "09:00" } })).status, 201);
});

test("cadastro recusa perfil/dados inválidos e e-mail já usado", async () => {
    const token = "teste:uid-x:x@exemplo.com:X";
    assert.equal((await chamar("POST", "/usuarios", { token, corpo: { perfil: "admin", nome: "X" } })).status, 400);
    assert.equal((await chamar("POST", "/usuarios", { token, corpo: { perfil: "cliente" } })).status, 400);                        // sem nome
    assert.equal((await chamar("POST", "/usuarios", { token, corpo: { perfil: "profissional", nome: "X", telefone: "1" } })).status, 400);   // sem dados do local
    assert.equal((await chamar("POST", "/usuarios", { token, corpo: { perfil: "profissional", nome: "X", telefone: "1", profissional: { ...ENDERECO, cep: "123" } } })).status, 400);
    assert.equal((await chamar("POST", "/usuarios", { token, corpo: { perfil: "profissional", nome: "X", telefone: "1", profissional: { ...ENDERECO, uf: "ZZ" } } })).status, 400);
    // e-mail do Igor (já existe no banco) com outro uid do Firebase
    assert.equal((await chamar("POST", "/usuarios", { token: "teste:uid-y:igor@exemplo.com:Outro", corpo: { perfil: "cliente", nome: "Outro" } })).status, 409);
    assert.equal((await chamar("GET", "/me", { token })).dados.codigo, "CADASTRO_INCOMPLETO");                                      // nada foi criado
});

test("cadastro de profissional: cria o local, entra como profissional e já pode criar serviços", async () => {
    const token = "teste:uid-pedro-prof:pedro.prof@exemplo.com:Pedro Prof";
    const criado = await chamar("POST", "/usuarios", { token, corpo: { perfil: "profissional", nome: "Pedro Prof", telefone: "(11) 95555-0000", profissional: ENDERECO } });
    assert.equal(criado.status, 201);
    assert.equal(criado.dados.perfil, "profissional");
    assert.ok(criado.dados.profissionalId);

    const eu = (await chamar("GET", "/me", { token })).dados;
    assert.equal(eu.profissionalId, criado.dados.profissionalId);

    const servico = await chamar("POST", "/servicos", { token, corpo: { nome: "Corte", categoria: "Barbearia", descricao: "Corte simples.", duracaoMin: 30, preco: 40 } });
    assert.equal(servico.status, 201);
    assert.equal(servico.dados.profissionalId, eu.profissionalId);

    // aparece na lista de locais, mas sem distância (ainda sem coordenadas), por último
    const locais = (await chamar("GET", "/profissionais?origem=centro")).dados;
    const novo = locais[locais.length - 1];
    assert.equal(novo.local, "Barbearia Nova");
    assert.equal(novo.distanciaKm, null);
    assert.ok(locais.slice(0, -1).every((p) => typeof p.distanciaKm === "number"));
    // um cliente não consegue virar profissional por conta própria: o perfil só é gravado no cadastro
    assert.equal((await chamar("POST", "/servicos", { usuario: IGOR, corpo: { nome: "x", categoria: "x", descricao: "x", duracaoMin: 30, preco: 1 } })).status, 403);
});

test("token inválido não derruba o catálogo público", async () => {
    assert.equal((await chamar("GET", "/servicos", { token: "lixo" })).status, 200);
    assert.equal((await chamar("GET", "/me", { token: "lixo" })).status, 401);
});
