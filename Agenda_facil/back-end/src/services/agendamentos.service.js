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
const { STATUS, ATIVOS, TRANSICOES } = require("./status");
const { limiteDiasAgendamento } = require("../config/env");
const foraDoLimite = () => requisicaoInvalida(`Só é possível agendar até ${limiteDiasAgendamento} dias à frente.`);
const { requisicaoInvalida, naoEncontrado, proibido, conflito } = require("../middlewares/erros");

// Reserva "um de cada vez" por profissional. Se a fila demorar demais, responde 409 (tente de novo), nunca 500.
async function reservarNaAgenda(profissionalId, tarefa) {
    try {
        return await modelo.comTravaDoProfissional(profissionalId, tarefa);
    } catch (erro) {
        if (erro.code === "TRAVA_TEMPO_ESGOTADO") throw conflito("A agenda está muito movimentada agora. Tente de novo em instantes.");
        throw erro;
    }
}

// Dois clientes no mesmo horário ao mesmo tempo: o UNIQUE do MySQL recusa o segundo (ER_DUP_ENTRY)
async function gravarSemConflito(operacao) {
    try {
        return await operacao();
    } catch (erro) {
        if (erro.code === "ER_DUP_ENTRY") throw conflito("Este horário não está mais disponível.");
        throw erro;
    }
}


// Monta o agendamento no formato que o front-end usa (com serviço, profissional e cliente)
async function formatar(a, populares) {
    const [servico, profissional, cliente] = await Promise.all([
        modelo.servicoPorId(a.servicoId), modelo.profissionalPorId(a.profissionalId), modelo.usuarioPorId(a.usuarioId)
    ]);
    const donoDoLocal = await modelo.usuarioPorId(profissional.usuarioId);
    // Conta desativada depois do agendamento: o histórico continua aparecendo, sem os dados pessoais
    const pessoa = (u) => u || { id: null, nome: "Conta desativada", telefone: null };
    return {
        id: a.id, clienteId: a.usuarioId, servicoId: a.servicoId, profissionalId: a.profissionalId,
        data: a.data, hora: a.hora, status: a.status,
        servico: servicos.formatar(servico, populares),
        profissional: { id: profissional.id, nome: pessoa(donoDoLocal).nome, local: profissional.nomeLocal, endereco: `${profissional.logradouro}, ${profissional.numero} - ${profissional.bairro}` },
        cliente: { id: pessoa(cliente).id, nome: pessoa(cliente).nome, telefone: pessoa(cliente).telefone }
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

// GET /api/agendamentos?status=&data=  ou  ?de=AAAA-MM-DD&ate=AAAA-MM-DD  (a lista é sempre do usuário logado)
async function listar(usuario, { status, data, de, ate }) {
    if (status && !STATUS.includes(status)) throw requisicaoInvalida(`Status inválido. Use: ${STATUS.join(", ")}.`);
    for (const [nome, valor] of [["data", data], ["de", de], ["ate", ate]]) {
        if (valor && !horarios.dataValida(valor)) throw requisicaoInvalida(`Informe "${nome}" no formato AAAA-MM-DD.`);
    }
    if (data && (de || ate)) throw requisicaoInvalida('Use "data" (um dia) ou "de"/"ate" (um período), não os dois.');
    if (de && ate && de > ate) throw requisicaoInvalida('A data "de" precisa ser anterior ou igual a "ate".');
    const filtro = { status, data, de, ate };
    if (usuario.perfil === "cliente") filtro.usuarioId = usuario.id; else filtro.profissionalId = usuario.profissionalId;
    // Segurança: o modelo ignora filtros vazios, então uma consulta sem dono devolveria agendamentos de todos
    if (!filtro.usuarioId && !filtro.profissionalId) throw proibido("Não foi possível identificar de quem são os agendamentos.");

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
    if (horarios.alemDoLimite(data)) throw foraDoLimite();

    const servico = await modelo.servicoPorId(servicoId);
    if (!servico || !servico.ativo) throw naoEncontrado("Serviço não encontrado ou desativado.");
    if (servico.profissionalId !== Number(profissionalId)) throw requisicaoInvalida("Este serviço não é oferecido por este profissional.");
    const profissional = await modelo.profissionalPorId(servico.profissionalId);
    if (!profissional || !profissional.ativo) throw naoEncontrado("Este profissional não está recebendo agendamentos.");

    // Conferir e gravar acontecem "um de cada vez" por profissional: assim dois clientes não reservam
    // ao mesmo tempo horários que se sobrepõem (ex.: 09:00 com 90 min e 10:00).
    const criado = await reservarNaAgenda(servico.profissionalId, async () => {
        const estado = await horarios.estadoDoHorario(servico.profissionalId, data, hora, { duracaoMin: servico.duracaoMin });
        if (estado !== "disponivel") throw conflito("Este horário não está mais disponível.");
        return gravarSemConflito(() =>
            modelo.criarAgendamento({ usuarioId: usuario.id, servicoId: servico.id, profissionalId: servico.profissionalId, data, hora }));
    });
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
    if (horarios.alemDoLimite(corpo.data)) throw foraDoLimite();

    const servico = await modelo.servicoPorId(a.servicoId);
    const profissional = await modelo.profissionalPorId(a.profissionalId);
    if (!profissional || !profissional.ativo) throw naoEncontrado("Este profissional não está recebendo agendamentos.");
    const atualizado = await reservarNaAgenda(a.profissionalId, async () => {
        const estado = await horarios.estadoDoHorario(a.profissionalId, corpo.data, corpo.hora,
            { duracaoMin: servico.duracaoMin, ignorarAgendamentoId: a.id });
        if (estado !== "disponivel") throw conflito("Este horário não está disponível.");
        return gravarSemConflito(() => modelo.atualizarAgendamento(a.id, { data: corpo.data, hora: corpo.hora }));
    });
    return formatar(atualizado, await servicos.idsPopulares());
}

// DELETE /api/agendamentos/:id  (cliente, só enquanto estiver pendente; os demais casos usam o cancelamento)
async function excluir(usuario, id) {
    if (usuario.perfil !== "cliente") throw proibido("Só o cliente exclui o próprio agendamento.");
    const a = await buscarDoUsuario(usuario, id);
    if (a.status !== "PENDENTE") throw requisicaoInvalida("Só é possível excluir agendamentos pendentes. Use o cancelamento.");
    await modelo.excluirAgendamento(a.id);
}

module.exports = { listar, criar, alterarStatus, reagendar, excluir };
