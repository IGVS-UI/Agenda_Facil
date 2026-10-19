/*
 * Status de agendamento e suas transições (um só lugar, usado por todos os serviços).
 * PENDENTE -> CONFIRMADO -> CONCLUIDO, ou -> CANCELADO a partir de pendente/confirmado.
 */
const STATUS = ["PENDENTE", "CONFIRMADO", "CONCLUIDO", "CANCELADO"];

// Status em que o agendamento ainda ocupa o horário do profissional
const ATIVOS = ["PENDENTE", "CONFIRMADO"];

const TRANSICOES = {
    PENDENTE: ["CONFIRMADO", "CANCELADO"],
    CONFIRMADO: ["CONCLUIDO", "CANCELADO"],
    CONCLUIDO: [],
    CANCELADO: []
};

module.exports = { STATUS, ATIVOS, TRANSICOES };
