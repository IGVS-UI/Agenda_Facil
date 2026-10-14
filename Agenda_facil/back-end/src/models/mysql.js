/*
 * MODELO (acesso aos dados) — versão MySQL.
 *
 * Tem as MESMAS funções de memoria.js e devolve os dados no mesmo formato (camelCase, status em
 * MAIÚSCULAS, horas "HH:MM", datas "AAAA-MM-DD"). Por isso os serviços e o front-end não mudam.
 * Todas as consultas usam parâmetros (?), nunca texto montado: isso evita SQL injection.
 *
 * Tabelas: usuario, profissional, servico, disponibilidade_semanal, bloqueio, agendamento
 * (criadas por database/criar_banco.sql).
 */
const mysql = require("mysql2/promise");
const { bd } = require("../config/env");

let pool;
function conexoes() {
    if (!pool) {
        pool = mysql.createPool({
            host: bd.host, port: bd.port, user: bd.user, password: bd.password, database: bd.database,
            waitForConnections: true, connectionLimit: 10,
            dateStrings: true,        // DATE/DATETIME chegam como texto "AAAA-MM-DD", sem mexer no fuso
            decimalNumbers: true,     // DECIMAL (preço, latitude) chega como número
            charset: "utf8mb4"
        });
    }
    return pool;
}
const consultar = async (sql, parametros = []) => (await conexoes().execute(sql, parametros))[0];
const primeira = async (sql, parametros) => (await consultar(sql, parametros))[0];

/* Conversões banco <-> formato da API */
const hora = (coluna) => `TIME_FORMAT(${coluna}, '%H:%i')`;               // coluna TIME -> "09:00"
const horaSql = (texto) => `${texto}:00`;                               // "09:00" -> "09:00:00"
const maisUmaHora = (texto) => `${String(Number(texto.slice(0, 2)) + 1).padStart(2, "0")}:${texto.slice(3, 5)}:00`;

const comoUsuario = (l) => l && { id: l.id_usuario, nome: l.nome, email: l.email, telefone: l.telefone, tipo: l.tipo };
const comoProfissional = (l) => l && {
    id: l.id_profissional, usuarioId: l.usuario_id, nomeLocal: l.nome_local, logradouro: l.logradouro, numero: l.numero,
    bairro: l.bairro, cidade: l.cidade, uf: l.uf, latitude: l.latitude, longitude: l.longitude,
    avaliacao: null,        // ainda não existe no banco (funcionalidade futura)
    ativo: Boolean(l.ativo)
};
const comoServico = (l) => l && {
    id: l.id_servico, profissionalId: l.profissional_id, nome: l.nome, categoria: l.categoria, descricao: l.descricao,
    duracaoMin: l.duracao_minutos, preco: l.preco, ativo: Boolean(l.ativo)
};
const comoAgendamento = (l) => l && {
    id: l.id_agendamento, usuarioId: l.usuario_id, servicoId: l.servico_id, profissionalId: l.profissional_id,
    data: l.data, hora: l.hora, status: String(l.status).toUpperCase()
};

const COLUNAS_AGENDAMENTO = `id_agendamento, usuario_id, servico_id, profissional_id,
    data_agendamento AS data, ${hora("hora_inicio")} AS hora, status`;

module.exports = {
    /* ---------- usuários ---------- */
    usuarioPorId: async (id) => comoUsuario(await primeira("SELECT * FROM usuario WHERE id_usuario = ? AND ativo = 1", [Number(id)])),

    /* ---------- profissionais ---------- */
    listarProfissionais: async () => (await consultar("SELECT * FROM profissional WHERE ativo = 1 ORDER BY id_profissional")).map(comoProfissional),
    profissionalPorId: async (id) => comoProfissional(await primeira("SELECT * FROM profissional WHERE id_profissional = ?", [Number(id)])),
    profissionalPorUsuarioId: async (usuarioId) => comoProfissional(await primeira("SELECT * FROM profissional WHERE usuario_id = ?", [Number(usuarioId)])),

    /* ---------- serviços ---------- */
    listarServicos: async ({ profissionalId } = {}) => (await (profissionalId
        ? consultar("SELECT * FROM servico WHERE profissional_id = ? ORDER BY id_servico", [Number(profissionalId)])
        : consultar("SELECT * FROM servico ORDER BY id_servico"))).map(comoServico),
    servicoPorId: async (id) => comoServico(await primeira("SELECT * FROM servico WHERE id_servico = ?", [Number(id)])),
    criarServico: async (d) => {
        const r = await consultar(
            "INSERT INTO servico (profissional_id, nome, categoria, descricao, duracao_minutos, preco, ativo) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [d.profissionalId, d.nome, d.categoria, d.descricao, d.duracaoMin, d.preco, d.ativo === false ? 0 : 1]);
        return comoServico(await primeira("SELECT * FROM servico WHERE id_servico = ?", [r.insertId]));
    },
    atualizarServico: async (id, campos) => {
        const colunas = { nome: "nome", categoria: "categoria", descricao: "descricao", duracaoMin: "duracao_minutos", preco: "preco", ativo: "ativo" };
        const itens = Object.keys(campos).filter((c) => colunas[c]);
        if (itens.length) {
            await consultar(`UPDATE servico SET ${itens.map((c) => `${colunas[c]} = ?`).join(", ")} WHERE id_servico = ?`,
                [...itens.map((c) => (c === "ativo" ? (campos[c] ? 1 : 0) : campos[c])), Number(id)]);
        }
        return comoServico(await primeira("SELECT * FROM servico WHERE id_servico = ?", [Number(id)]));
    },

    /* ---------- agenda semanal e bloqueios ---------- */
    horasDoDia: async (profissionalId, diaSemana) =>
        (await consultar(`SELECT ${hora("hora_inicio")} AS h FROM disponibilidade_semanal WHERE profissional_id = ? AND dia_semana = ? ORDER BY hora_inicio`,
            [Number(profissionalId), diaSemana])).map((l) => l.h),
    disponibilidadeDe: async (profissionalId) => {
        const resultado = {};
        const linhas = await consultar(
            `SELECT dia_semana, ${hora("hora_inicio")} AS h FROM disponibilidade_semanal WHERE profissional_id = ? ORDER BY dia_semana, hora_inicio`, [Number(profissionalId)]);
        for (const l of linhas) (resultado[l.dia_semana] = resultado[l.dia_semana] || []).push(l.h);
        return resultado;
    },
    bloqueiosDe: async (profissionalId) =>
        (await consultar(`SELECT data_bloqueio AS data, ${hora("hora_inicio")} AS hora FROM bloqueio WHERE profissional_id = ? ORDER BY data_bloqueio, hora_inicio`,
            [Number(profissionalId)])).map((l) => ({ data: l.data, hora: l.hora })),
    estaBloqueado: async (profissionalId, data, h) =>
        Boolean(await primeira("SELECT 1 AS x FROM bloqueio WHERE profissional_id = ? AND data_bloqueio = ? AND hora_inicio = ? LIMIT 1", [Number(profissionalId), data, horaSql(h)])),
    // Troca a agenda inteira do profissional, de forma atômica (tudo ou nada)
    substituirDisponibilidade: async (profissionalId, disponibilidade, listaBloqueios) => {
        const id = Number(profissionalId);
        const conexao = await conexoes().getConnection();
        try {
            await conexao.beginTransaction();
            await conexao.execute("DELETE FROM disponibilidade_semanal WHERE profissional_id = ?", [id]);
            await conexao.execute("DELETE FROM bloqueio WHERE profissional_id = ?", [id]);
            for (const [dia, horas] of Object.entries(disponibilidade)) {
                for (const h of horas) {
                    await conexao.execute("INSERT INTO disponibilidade_semanal (profissional_id, dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?, ?)",
                        [id, Number(dia), horaSql(h), maisUmaHora(h)]);
                }
            }
            for (const b of listaBloqueios) {
                await conexao.execute("INSERT INTO bloqueio (profissional_id, data_bloqueio, hora_inicio) VALUES (?, ?, ?)", [id, b.data, horaSql(b.hora)]);
            }
            await conexao.commit();
        } catch (erro) {
            await conexao.rollback();
            throw erro;
        } finally {
            conexao.release();
        }
    },

    /* ---------- agendamentos ---------- */
    listarAgendamentos: async ({ usuarioId, profissionalId, status, data } = {}) => {
        const condicoes = [], parametros = [];
        if (usuarioId) { condicoes.push("usuario_id = ?"); parametros.push(Number(usuarioId)); }
        if (profissionalId) { condicoes.push("profissional_id = ?"); parametros.push(Number(profissionalId)); }
        if (status) { condicoes.push("status = ?"); parametros.push(status.toLowerCase()); }
        if (data) { condicoes.push("data_agendamento = ?"); parametros.push(data); }
        const onde = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
        return (await consultar(`SELECT ${COLUNAS_AGENDAMENTO} FROM agendamento ${onde} ORDER BY data_agendamento, hora_inicio`, parametros)).map(comoAgendamento);
    },
    agendamentoPorId: async (id) => comoAgendamento(await primeira(`SELECT ${COLUNAS_AGENDAMENTO} FROM agendamento WHERE id_agendamento = ?`, [Number(id)])),
    // Há agendamento ATIVO (pendente/confirmado) neste horário?
    horarioOcupado: async (profissionalId, data, h, ignorarId) =>
        Boolean(await primeira(
            `SELECT 1 AS x FROM agendamento WHERE profissional_id = ? AND data_agendamento = ? AND hora_inicio = ?
             AND status IN ('pendente', 'confirmado') AND id_agendamento <> ? LIMIT 1`,
            [Number(profissionalId), data, horaSql(h), ignorarId ? Number(ignorarId) : 0])),
    // Se dois clientes tentarem o mesmo horário ao mesmo tempo, o UNIQUE do banco recusa o segundo (ER_DUP_ENTRY)
    criarAgendamento: async (d) => {
        const r = await consultar(
            "INSERT INTO agendamento (usuario_id, servico_id, profissional_id, data_agendamento, hora_inicio, status) VALUES (?, ?, ?, ?, ?, 'pendente')",
            [d.usuarioId, d.servicoId, d.profissionalId, d.data, horaSql(d.hora)]);
        return comoAgendamento(await primeira(`SELECT ${COLUNAS_AGENDAMENTO} FROM agendamento WHERE id_agendamento = ?`, [r.insertId]));
    },
    atualizarAgendamento: async (id, campos) => {
        const sets = [], parametros = [];
        if (campos.status) { sets.push("status = ?"); parametros.push(campos.status.toLowerCase()); }
        if (campos.data) { sets.push("data_agendamento = ?"); parametros.push(campos.data); }
        if (campos.hora) { sets.push("hora_inicio = ?"); parametros.push(horaSql(campos.hora)); }
        if (sets.length) await consultar(`UPDATE agendamento SET ${sets.join(", ")} WHERE id_agendamento = ?`, [...parametros, Number(id)]);
        return comoAgendamento(await primeira(`SELECT ${COLUNAS_AGENDAMENTO} FROM agendamento WHERE id_agendamento = ?`, [Number(id)]));
    },
    excluirAgendamento: async (id) => { await consultar("DELETE FROM agendamento WHERE id_agendamento = ?", [Number(id)]); },
    contarAgendamentosPorServico: async () => {
        const contagem = {};
        for (const l of await consultar("SELECT servico_id, COUNT(*) AS total FROM agendamento GROUP BY servico_id ORDER BY servico_id")) contagem[l.servico_id] = l.total;
        return contagem;
    },

    /* ---------- apoio ---------- */
    // Confere a conexão ao ligar a API (falha cedo, com mensagem clara)
    verificarConexao: async () => { await consultar("SELECT 1"); },
    encerrar: async () => { if (pool) { await pool.end(); pool = null; } },

    // Recarrega os dados de exemplo. APAGA TUDO: por segurança só roda em banco cujo nome termina em "_teste".
    restaurar: async () => {
        if (!/_teste$/i.test(bd.database)) {
            throw new Error(`restaurar() apaga todos os dados e só roda em bancos de teste (nome terminando em "_teste"). Banco atual: ${bd.database}.`);
        }
        const { gerar } = require("./dadosExemplo");
        const dados = gerar();
        const conexao = await conexoes().getConnection();
        try {
            await conexao.query("SET FOREIGN_KEY_CHECKS = 0");
            for (const tabela of ["agendamento", "bloqueio", "disponibilidade_semanal", "servico", "profissional", "usuario"]) {
                await conexao.query(`TRUNCATE TABLE ${tabela}`);
            }
            await conexao.query("SET FOREIGN_KEY_CHECKS = 1");
            for (const u of dados.usuarios) {
                await conexao.execute("INSERT INTO usuario (id_usuario, nome, email, telefone, tipo) VALUES (?, ?, ?, ?, ?)", [u.id, u.nome, u.email, u.telefone, u.tipo]);
            }
            for (const p of dados.profissionais) {
                const especialidade = (dados.servicos.find((s) => s.profissionalId === p.id) || {}).categoria || "Geral";
                const celular = dados.usuarios.find((u) => u.id === p.usuarioId).telefone;
                await conexao.execute(
                    `INSERT INTO profissional (id_profissional, usuario_id, nome_local, especialidade, celular, logradouro, numero, bairro, cidade, uf, latitude, longitude)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [p.id, p.usuarioId, p.nomeLocal, especialidade, celular, p.logradouro, p.numero, p.bairro, p.cidade, p.uf, p.latitude, p.longitude]);
            }
            for (const s of dados.servicos) {
                await conexao.execute(
                    "INSERT INTO servico (id_servico, profissional_id, nome, categoria, descricao, duracao_minutos, preco, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [s.id, s.profissionalId, s.nome, s.categoria, s.descricao, s.duracaoMin, s.preco, s.ativo ? 1 : 0]);
            }
            for (const d of dados.disponibilidadeSemanal) {
                await conexao.execute("INSERT INTO disponibilidade_semanal (profissional_id, dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?, ?)",
                    [d.profissionalId, d.diaSemana, horaSql(d.horaInicio), maisUmaHora(d.horaInicio)]);
            }
            for (const b of dados.bloqueios) {
                await conexao.execute("INSERT INTO bloqueio (profissional_id, data_bloqueio, hora_inicio) VALUES (?, ?, ?)", [b.profissionalId, b.data, horaSql(b.hora)]);
            }
            for (const a of dados.agendamentos) {
                await conexao.execute(
                    "INSERT INTO agendamento (id_agendamento, usuario_id, servico_id, profissional_id, data_agendamento, hora_inicio, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [a.id, a.usuarioId, a.servicoId, a.profissionalId, a.data, horaSql(a.hora), a.status.toLowerCase()]);
            }
        } finally {
            conexao.release();
        }
    }
};
