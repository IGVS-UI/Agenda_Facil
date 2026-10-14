/*
 * Horários de um profissional: quais existem em cada dia e em que estado estão.
 *   disponivel   - pode ser escolhido
 *   ocupado      - já existe agendamento ativo (pendente ou confirmado)
 *   indisponivel - bloqueado pelo profissional ou já passou
 * Esta é a regra definitiva contra conflito de horário (o front-end só a representa).
 */
const modelo = require("../models");
const { requisicaoInvalida, naoEncontrado } = require("../middlewares/erros");

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

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

const horaValida = (texto) => typeof texto === "string" && FORMATO_HORA.test(texto);
const jaPassou = (data, hora) => new Date(`${data}T${hora}:00`) < new Date();

// Estado de UM horário. "ignorarAgendamentoId" serve ao reagendamento (o próprio agendamento não conta).
async function estadoDoHorario(profissionalId, data, hora, ignorarAgendamentoId) {
    const diaSemana = new Date(`${data}T00:00:00`).getDay();
    const doDia = await modelo.horasDoDia(profissionalId, diaSemana);
    if (!doDia.includes(hora)) return "indisponivel";                       // o profissional não atende neste horário
    if (jaPassou(data, hora)) return "indisponivel";
    if (await modelo.estaBloqueado(profissionalId, data, hora)) return "indisponivel";
    if (await modelo.horarioOcupado(profissionalId, data, hora, ignorarAgendamentoId)) return "ocupado";
    return "disponivel";
}

// GET /api/horarios-disponiveis?profissionalId=&data=AAAA-MM-DD
async function listar({ profissionalId, data }) {
    if (!profissionalId) throw requisicaoInvalida("Informe o profissionalId.");
    if (!dataValida(data)) throw requisicaoInvalida("Informe a data no formato AAAA-MM-DD.");
    const profissional = await modelo.profissionalPorId(profissionalId);
    if (!profissional) throw naoEncontrado("Profissional não encontrado.");

    const diaSemana = new Date(`${data}T00:00:00`).getDay();
    const horas = await modelo.horasDoDia(profissional.id, diaSemana);
    return Promise.all(horas.map(async (hora) => ({ hora, estado: await estadoDoHorario(profissional.id, data, hora) })));
}

module.exports = { listar, estadoDoHorario, dataValida, horaValida, dataLocalIso };
