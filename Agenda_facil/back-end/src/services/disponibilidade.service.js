/*
 * Disponibilidade do profissional: horários da semana + bloqueios.
 * Formato (igual ao do front-end):
 *   disponibilidade: { "1": ["09:00", "10:00"], "2": [...] }   (0 = domingo ... 6 = sábado)
 *   bloqueios:       [{ data: "AAAA-MM-DD", hora: "14:00" }]
 * Só o próprio profissional lê e altera a sua agenda.
 */
const modelo = require("../models");
const { dataValida, horaValida } = require("./horarios.service");
const { requisicaoInvalida, proibido, naoEncontrado } = require("../middlewares/erros");

async function conferirDono(usuario, profissionalId) {
    const profissional = await modelo.profissionalPorId(profissionalId);
    if (!profissional) throw naoEncontrado("Profissional não encontrado.");
    if (profissional.id !== usuario.profissionalId) throw proibido("Esta agenda não é sua.");
    return profissional;
}

// GET /api/profissionais/:id/disponibilidade
async function obter(usuario, profissionalId) {
    const p = await conferirDono(usuario, profissionalId);
    const [disponibilidade, bloqueios] = await Promise.all([modelo.disponibilidadeDe(p.id), modelo.bloqueiosDe(p.id)]);
    return { disponibilidade, bloqueios };
}

// PUT /api/profissionais/:id/disponibilidade  (troca a agenda inteira)
async function salvar(usuario, profissionalId, corpo) {
    const p = await conferirDono(usuario, profissionalId);
    const { disponibilidade, bloqueios } = corpo;
    if (typeof disponibilidade !== "object" || disponibilidade === null || Array.isArray(disponibilidade)) {
        throw requisicaoInvalida("Informe a disponibilidade como { dia: [horários] }.");
    }
    if (!Array.isArray(bloqueios)) throw requisicaoInvalida("Informe os bloqueios como uma lista.");

    const limpa = {};
    for (const [dia, lista] of Object.entries(disponibilidade)) {
        if (!/^[0-6]$/.test(dia)) throw requisicaoInvalida(`Dia da semana inválido: ${dia}. Use de 0 (domingo) a 6 (sábado).`);
        if (!Array.isArray(lista)) throw requisicaoInvalida(`Os horários do dia ${dia} devem ser uma lista.`);
        for (const h of lista) if (!horaValida(h)) throw requisicaoInvalida(`Horário inválido: ${h}. Use HH:MM.`);
        const unicos = [...new Set(lista)].sort();
        if (unicos.length) limpa[dia] = unicos;
    }

    const vistos = new Set();
    const bloqueiosLimpos = [];
    for (const b of bloqueios) {
        if (!b || !dataValida(b.data) || !horaValida(b.hora)) throw requisicaoInvalida("Cada bloqueio precisa de data (AAAA-MM-DD) e hora (HH:MM).");
        const chave = `${b.data}|${b.hora}`;
        if (!vistos.has(chave)) { vistos.add(chave); bloqueiosLimpos.push({ data: b.data, hora: b.hora }); }
    }

    await modelo.substituirDisponibilidade(p.id, limpa, bloqueiosLimpos);
    return { disponibilidade: limpa, bloqueios: bloqueiosLimpos };
}

module.exports = { obter, salvar };
