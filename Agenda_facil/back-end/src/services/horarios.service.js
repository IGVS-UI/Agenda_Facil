/*
 * Horários de um profissional: quais existem em cada dia e em que estado estão.
 *   disponivel   - pode ser escolhido
 *   ocupado      - o tempo do serviço se sobrepõe a um agendamento ativo (pendente ou confirmado)
 *   indisponivel - o profissional não atende, bloqueou o horário, ou já passou
 *
 * A regra compara INTERVALOS, não só o horário de início: um serviço de 90 min às 09:00 ocupa até
 * 10:30, então ninguém marca às 10:00; e quem quer um serviço de 90 min às 09:00 não consegue se já
 * houver alguém às 10:00. Esta é a regra definitiva contra conflito (o front-end só a representa).
 */
const modelo = require("../models");
const { ATIVOS } = require("./status");
const { limiteDiasAgendamento } = require("../config/env");
const { requisicaoInvalida, naoEncontrado } = require("../middlewares/erros");

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
// Cada horário da agenda dura 1 hora (é o que o bloqueio de um horário cobre)
const DURACAO_DO_HORARIO = 60;

function dataLocalIso(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "2026-02-30" tem o formato certo mas não existe: a conferência de volta recusa
function dataValida(texto) {
    if (typeof texto !== "string" || !FORMATO_DATA.test(texto)) return false;
    const d = new Date(`${texto}T00:00:00`);
    return !Number.isNaN(d.getTime()) && dataLocalIso(d) === texto;
}

// Datas depois do limite (LIMITE_DIAS_AGENDAMENTO, padrão 90 dias) não podem ser agendadas
function alemDoLimite(data) {
    const limite = new Date();
    limite.setDate(limite.getDate() + limiteDiasAgendamento);
    return data > dataLocalIso(limite);
}

const horaValida = (texto) => typeof texto === "string" && FORMATO_HORA.test(texto);
const jaPassou = (data, hora) => new Date(`${data}T${hora}:00`) < new Date();
const diaDaSemana = (data) => new Date(`${data}T00:00:00`).getDay();
const minutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const seSobrepoem = (a, b) => a.inicio < b.fim && b.inicio < a.fim;

// Tudo o que já ocupa ou bloqueia o dia do profissional, em intervalos de minutos
async function ocupacaoDoDia(profissionalId, data, ignorarAgendamentoId) {
    const agendamentos = (await modelo.listarAgendamentos({ profissionalId, data }))
        .filter((a) => ATIVOS.includes(a.status) && a.id !== ignorarAgendamentoId);
    const duracoes = new Map();
    for (const a of agendamentos) {
        if (!duracoes.has(a.servicoId)) {
            const servico = await modelo.servicoPorId(a.servicoId);
            duracoes.set(a.servicoId, servico ? servico.duracaoMin : DURACAO_DO_HORARIO);
        }
    }
    const intervalo = (hora, duracao) => ({ inicio: minutos(hora), fim: minutos(hora) + duracao });
    return {
        horasDoDia: await modelo.horasDoDia(profissionalId, diaDaSemana(data)),
        agendamentos: agendamentos.map((a) => intervalo(a.hora, duracoes.get(a.servicoId))),
        bloqueios: (await modelo.bloqueiosDe(profissionalId)).filter((b) => b.data === data).map((b) => intervalo(b.hora, DURACAO_DO_HORARIO))
    };
}

// Estado de UM início de horário, para um serviço com "duracao" minutos
function estado(ocupacao, data, hora, duracao) {
    const pedido = { inicio: minutos(hora), fim: minutos(hora) + duracao };
    if (!ocupacao.horasDoDia.includes(hora)) return "indisponivel";          // o profissional não atende neste horário
    if (jaPassou(data, hora) || alemDoLimite(data)) return "indisponivel";
    if (ocupacao.bloqueios.some((b) => seSobrepoem(pedido, b))) return "indisponivel";
    if (ocupacao.agendamentos.some((a) => seSobrepoem(pedido, a))) return "ocupado";
    return "disponivel";
}

// Usado ao criar/reagendar. "ignorarAgendamentoId": no reagendamento, o próprio agendamento não conta.
async function estadoDoHorario(profissionalId, data, hora, { duracaoMin = DURACAO_DO_HORARIO, ignorarAgendamentoId } = {}) {
    return estado(await ocupacaoDoDia(profissionalId, data, ignorarAgendamentoId), data, hora, duracaoMin);
}

// GET /api/horarios-disponiveis?profissionalId=&data=AAAA-MM-DD[&servicoId=]
// Com servicoId, o estado considera a duração daquele serviço (é o que o cliente vai agendar).
async function listar({ profissionalId, data, servicoId }) {
    if (!profissionalId) throw requisicaoInvalida("Informe o profissionalId.");
    if (!dataValida(data)) throw requisicaoInvalida("Informe a data no formato AAAA-MM-DD.");
    const profissional = await modelo.profissionalPorId(profissionalId);
    if (!profissional || !profissional.ativo) throw naoEncontrado("Profissional não encontrado ou não está recebendo agendamentos.");

    let duracao = DURACAO_DO_HORARIO;
    if (servicoId) {
        const servico = await modelo.servicoPorId(servicoId);
        if (!servico || servico.profissionalId !== profissional.id) throw requisicaoInvalida("Este serviço não é oferecido por este profissional.");
        duracao = servico.duracaoMin;
    }
    const ocupacao = await ocupacaoDoDia(profissional.id, data);
    return ocupacao.horasDoDia.map((hora) => ({ hora, estado: estado(ocupacao, data, hora, duracao) }));
}

module.exports = { listar, estadoDoHorario, dataValida, horaValida, alemDoLimite };
