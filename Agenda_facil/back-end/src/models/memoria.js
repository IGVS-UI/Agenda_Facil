/*
 * MODELO (acesso aos dados) — versão em MEMÓRIA.
 *
 * É a única camada que sabe de onde os dados vêm. Os serviços (regras de negócio) só chamam
 * as funções exportadas aqui. Na etapa do MySQL, este arquivo é substituído por outro com as
 * MESMAS funções (consultas SQL), e nada acima dele muda.
 *
 * Os dados espelham database/dados_exemplo.sql (mesmos ids). Datas relativas a hoje.
 * Tudo se perde ao reiniciar a API.
 */

const { gerar } = require("./dadosExemplo");

let usuarios, profissionais, servicos, disponibilidadeSemanal, bloqueios, agendamentos, proximoId;

function dadosIniciais() {
    ({ usuarios, profissionais, servicos, disponibilidadeSemanal, bloqueios, agendamentos } = gerar());
    proximoId = {
        usuario: Math.max(...usuarios.map((x) => x.id)) + 1, profissional: Math.max(...profissionais.map((x) => x.id)) + 1,
        servico: Math.max(...servicos.map((x) => x.id)) + 1, agendamento: Math.max(...agendamentos.map((x) => x.id)) + 1
    };
}
dadosIniciais();

const filas = new Map();   // filas de reserva por profissional (comTravaDoProfissional)
const copia = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

module.exports = {
    // apoio (o modelo MySQL tem as mesmas funções)
    verificarConexao: async () => {},
    encerrar: async () => {},
    // volta aos dados de exemplo (usado nos testes e em desenvolvimento)
    restaurar: async () => dadosIniciais(),

    /* ---------- usuários ---------- */
    // usuários desativados não entram (igual ao MySQL: "AND ativo = 1")
    usuarioPorId: async (id) => copia(usuarios.find((u) => u.id === Number(id) && u.ativo)),
    usuarioPorFirebaseUid: async (uid) => copia(usuarios.find((u) => u.firebaseUid && u.firebaseUid === uid && u.ativo)),
    usuarioPorEmail: async (email) => copia(usuarios.find((u) => u.email.toLowerCase() === String(email).toLowerCase())),
    religarFirebaseUid: async (id, uid) => {
        const u = usuarios.find((x) => x.id === Number(id) && x.ativo);
        if (!u) return null;
        u.firebaseUid = uid;
        return copia(u);
    },
    // Cria a conta (e o local, se for profissional) de uma vez só
    criarConta: async ({ usuario, profissional }) => {
        const novoUsuario = { id: proximoId.usuario++, ativo: true, ...usuario };
        usuarios.push(novoUsuario);
        let novoProfissional = null;
        if (profissional) {
            novoProfissional = { id: proximoId.profissional++, usuarioId: novoUsuario.id, avaliacao: null, ativo: true, complemento: null, ...profissional };
            profissionais.push(novoProfissional);
        }
        return copia({ usuario: novoUsuario, profissional: novoProfissional });
    },

    /* ---------- profissionais ---------- */
    listarProfissionais: async () => copia(profissionais.filter((p) => p.ativo)),
    profissionalPorId: async (id) => copia(profissionais.find((p) => p.id === Number(id))),
    profissionalPorUsuarioId: async (usuarioId) => copia(profissionais.find((p) => p.usuarioId === Number(usuarioId))),

    atualizarLocalizacaoDoProfissional: async (id, latitude, longitude) => {
        const p = profissionais.find((x) => x.id === Number(id));
        if (p) Object.assign(p, { latitude, longitude });
        return copia(p);
    },

    /* ---------- serviços ---------- */
    listarServicos: async ({ profissionalId } = {}) =>
        copia(servicos.filter((s) => !profissionalId || s.profissionalId === Number(profissionalId))),
    servicoPorId: async (id) => copia(servicos.find((s) => s.id === Number(id))),
    criarServico: async (dados) => {
        const novo = { id: proximoId.servico++, ativo: true, ...dados };
        servicos.push(novo);
        return copia(novo);
    },
    atualizarServico: async (id, campos) => {
        const s = servicos.find((x) => x.id === Number(id));
        Object.assign(s, campos);
        return copia(s);
    },

    servicoTemAgendamentos: async (id) => agendamentos.some((a) => a.servicoId === Number(id)),
    excluirServico: async (id) => { servicos = servicos.filter((s) => s.id !== Number(id)); },

    /* ---------- agenda semanal e bloqueios ---------- */
    horasDoDia: async (profissionalId, diaSemana) =>
        disponibilidadeSemanal
            .filter((d) => d.profissionalId === Number(profissionalId) && d.diaSemana === diaSemana)
            .map((d) => d.horaInicio).sort(),
    // { "1": ["09:00", ...], "2": [...] }
    disponibilidadeDe: async (profissionalId) => {
        const resultado = {};
        for (const d of disponibilidadeSemanal.filter((x) => x.profissionalId === Number(profissionalId))) {
            (resultado[d.diaSemana] = resultado[d.diaSemana] || []).push(d.horaInicio);
        }
        Object.values(resultado).forEach((lista) => lista.sort());
        return resultado;
    },
    bloqueiosDe: async (profissionalId) =>
        copia(bloqueios.filter((b) => b.profissionalId === Number(profissionalId)).map(({ data, hora }) => ({ data, hora }))),
    estaBloqueado: async (profissionalId, data, hora) =>
        bloqueios.some((b) => b.profissionalId === Number(profissionalId) && b.data === data && b.hora === hora),
    // Troca a agenda inteira do profissional (a API valida antes de chamar)
    substituirDisponibilidade: async (profissionalId, disponibilidade, listaBloqueios) => {
        const id = Number(profissionalId);
        disponibilidadeSemanal = disponibilidadeSemanal.filter((d) => d.profissionalId !== id);
        bloqueios = bloqueios.filter((b) => b.profissionalId !== id);
        for (const [dia, hs] of Object.entries(disponibilidade)) {
            for (const horaInicio of hs) disponibilidadeSemanal.push({ profissionalId: id, diaSemana: Number(dia), horaInicio });
        }
        for (const b of listaBloqueios) bloqueios.push({ profissionalId: id, data: b.data, hora: b.hora });
    },

    /* ---------- agendamentos ---------- */
    // filtros opcionais: { usuarioId (cliente), profissionalId, status, data, de, ate }  (de/ate: período, inclusive)
    listarAgendamentos: async ({ usuarioId, profissionalId, status, data, de, ate } = {}) =>
        copia(agendamentos.filter((a) =>
            (!usuarioId || a.usuarioId === Number(usuarioId)) &&
            (!profissionalId || a.profissionalId === Number(profissionalId)) &&
            (!status || a.status === status) &&
            (!data || a.data === data) &&
            (!de || a.data >= de) &&
            (!ate || a.data <= ate))),
    agendamentoPorId: async (id) => copia(agendamentos.find((a) => a.id === Number(id))),
    // Executa "tarefa" sem que outra reserva do MESMO profissional rode ao mesmo tempo (fila por profissional)
    comTravaDoProfissional: (profissionalId, tarefa) => {
        const chave = Number(profissionalId);
        const resultado = (filas.get(chave) || Promise.resolve()).then(tarefa);
        filas.set(chave, resultado.catch(() => {}));
        return resultado;
    },
    criarAgendamento: async (dados) => {
        const novo = { id: proximoId.agendamento++, status: "PENDENTE", ...dados };
        agendamentos.push(novo);
        return copia(novo);
    },
    atualizarAgendamento: async (id, campos) => {
        const a = agendamentos.find((x) => x.id === Number(id));
        Object.assign(a, campos);
        return copia(a);
    },
    excluirAgendamento: async (id) => {
        agendamentos = agendamentos.filter((a) => a.id !== Number(id));
    },
    contarAgendamentosPorServico: async () => {
        const contagem = {};
        for (const a of agendamentos) contagem[a.servicoId] = (contagem[a.servicoId] || 0) + 1;
        return contagem;
    }
};
