/*
 * Agendamentos: criar, listar, mudar status, reagendar e excluir.
 *
 * Regras (as definitivas; o front-end só as representa):
 *  - O cliente é SEMPRE quem está logado (clienteId enviado no corpo é ignorado).
 *  - Só dá para agendar um horário "disponivel" (não ocupado, não bloqueado, não passado).
 *  - O serviço precisa ser do profissional escolhido e estar ativo.
 *  - Cada pessoa só enxerga e altera os próprios agendamentos.
 *  - Status: PENDENTE -> CONFIRMADO -> CONCLUIDO, ou -> CANCELADO (a partir de pendente/confirmado).
 *    O profissional faz qualquer transição válida; o cliente só pode cancelar.
 */
const modelo = require("../models");
const horarios = require("./horarios.service");
const servicos = require("./servicos.service");
const { requisicaoInvalida, naoEncontrado, proibido, conflito } = require("../middlewares/erros");

// Dois clientes no mesmo horário ao mesmo tempo: o UNIQUE do MySQL recusa o segundo (ER_DUP_ENTRY)
async function gravarSemConflito(operacao) {
    try {
        return await operacao();
    } catch (erro) {
        if (erro.code === "ER_DUP_ENTRY") throw conflito("Este horário não está mais disponível.");
        throw erro;
    }
}

const STATUS = ["PENDENTE", "CONFIRMADO", "CONCLUIDO", "CANCELADO"];
const ATIVOS = ["PENDENTE", "CONFIRMADO"];
const TRANSICOES = {
    PENDENTE: ["CONFIRMADO", "CANCELADO"],
    CONFIRMADO: ["CONCLUIDO", "CANCELADO"],
    CONCLUIDO: [],
    CANCELADO: []
};

// Monta o agendamento no formato que o front-end usa (com serviço, profissional e cliente)
async function formatar(a, populares) {
    const [servico, profissional, cliente] = await Promise.all([
        modelo.servicoPorId(a.servicoId), modelo.profissionalPorId(a.profissionalId), modelo.usuarioPorId(a.usuarioId)
    ]);
    const donoDoLocal = await modelo.usuarioPorId(profissional.usuarioId);
    return {
        id: a.id, clienteId: a.usuarioId, servicoId: a.servicoId, profissionalId: a.profissionalId,
        data: a.data, hora: a.hora, status: a.status,
        servico: servicos.formatar(servico, populares),
        profissional: { id: profissional.id, nome: donoDoLocal.nome, local: profissional.nomeLocal, endereco: `${profissional.logradouro}, ${profissional.numero} - ${profissional.bairro}` },
        cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone }
    };
}

// O agendamento existe e é do usuário (como cliente ou como profissional)?
async function buscarDoUsuario(usuario, id) {
    const a = await modelo.agendamentoPorId(id);
    if (!a) throw naoEncontrado("Agendamento não encontrado.");
    const eDoCliente = usuario.perfil === "cliente" && a.usuarioId === usuario.id;
    const eDoProfissional = usuario.perfil === "profissional" && a.profissionalId === usuario.profissionalId;
    if (!eDoCliente && !eDoProfissional) throw proibido("Este agendamento não é seu.");
    return a;
}

// GET /api/agendamentos?status=&data=  (a lista é sempre do usuário logado)
async function listar(usuario, { status, data }) {
    if (status && !STATUS.includes(status)) throw requisicaoInvalida(`Status inválido. Use: ${STATUS.join(", ")}.`);
    if (data && !horarios.dataValida(data)) throw requisicaoInvalida("Informe a data no formato AAAA-MM-DD.");
    const filtro = { status, data };
    if (usuario.perfil === "cliente") filtro.usuarioId = usuario.id; else filtro.profissionalId = usuario.profissionalId;

    const [lista, populares] = await Promise.all([modelo.listarAgendamentos(filtro), servicos.idsPopulares()]);
    lista.sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
    return Promise.all(lista.map((a) => formatar(a, populares)));
}

// POST /api/agendamentos  { servicoId, profissionalId, data, hora }
async function criar(usuario, corpo) {
    const { servicoId, profissionalId, data, hora } = corpo;
    if (!servicoId || !profissionalId) throw requisicaoInvalida("Informe servicoId e profissionalId.");
    if (!horarios.dataValida(data)) throw requisicaoInvalida("Informe a data no formato AAAA-MM-DD.");
    if (!horarios.horaValida(hora)) throw requisicaoInvalida("Informe a hora no formato HH:MM.");

    const servico = await modelo.servicoPorId(servicoId);
    if (!servico || !servico.ativo) throw naoEncontrado("Serviço não encontrado ou desativado.");
    if (servico.profissionalId !== Number(profissionalId)) throw requisicaoInvalida("Este serviço não é oferecido por este profissional.");

    // Em memória nada se mistura entre conferir e gravar (não há espera de rede/disco). No MySQL,
    // o UNIQUE de agendamento garante o mesmo, mesmo com dois clientes ao mesmo tempo.
    const estado = await horarios.estadoDoHorario(servico.profissionalId, data, hora);
    if (estado !== "disponivel") throw conflito("Este horário não está mais disponível.");

    const criado = await gravarSemConflito(() =>
        modelo.criarAgendamento({ usuarioId: usuario.id, servicoId: servico.id, profissionalId: servico.profissionalId, data, hora }));
    return formatar(criado, await servicos.idsPopulares());
}

// PATCH /api/agendamentos/:id/status  { status }
async function alterarStatus(usuario, id, novoStatus) {
    if (!STATUS.includes(novoStatus)) throw requisicaoInvalida(`Status inválido. Use: ${STATUS.join(", ")}.`);
    const a = await buscarDoUsuario(usuario, id);
    if (!TRANSICOES[a.status].includes(novoStatus)) throw requisicaoInvalida(`Não é possível mudar de ${a.status} para ${novoStatus}.`);
    if (usuario.perfil === "cliente" && novoStatus !== "CANCELADO") throw proibido("O cliente só pode cancelar o agendamento.");

    const atualizado = await modelo.atualizarAgendamento(a.id, { status: novoStatus });
    return formatar(atualizado, await servicos.idsPopulares());
}

// PUT /api/agendamentos/:id  { data, hora }  (reagendar: só o cliente, só pendente/confirmado)
async function reagendar(usuario, id, corpo) {
    if (usuario.perfil !== "cliente") throw proibido("Só o cliente reagenda o próprio agendamento.");
    const a = await buscarDoUsuario(usuario, id);
    if (!ATIVOS.includes(a.status)) throw requisicaoInvalida("Só é possível reagendar agendamentos pendentes ou confirmados.");
    if (!horarios.dataValida(corpo.data)) throw requisicaoInvalida("Informe a data no formato AAAA-MM-DD.");
    if (!horarios.horaValida(corpo.hora)) throw requisicaoInvalida("Informe a hora no formato HH:MM.");

    const estado = await horarios.estadoDoHorario(a.profissionalId, corpo.data, corpo.hora, a.id);
    if (estado !== "disponivel") throw conflito("Este horário não está disponível.");

    const atualizado = await gravarSemConflito(() => modelo.atualizarAgendamento(a.id, { data: corpo.data, hora: corpo.hora }));
    return formatar(atualizado, await servicos.idsPopulares());
}

// DELETE /api/agendamentos/:id  (cliente, só enquanto estiver pendente; os demais casos usam o cancelamento)
async function excluir(usuario, id) {
    if (usuario.perfil !== "cliente") throw proibido("Só o cliente exclui o próprio agendamento.");
    const a = await buscarDoUsuario(usuario, id);
    if (a.status !== "PENDENTE") throw requisicaoInvalida("Só é possível excluir agendamentos pendentes. Use o cancelamento.");
    await modelo.excluirAgendamento(a.id);
}

module.exports = { listar, criar, alterarStatus, reagendar, excluir, STATUS, TRANSICOES };
