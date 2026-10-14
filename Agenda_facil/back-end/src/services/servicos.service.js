/*
 * Serviços. Qualquer pessoa vê os serviços ATIVOS; só o profissional dono cria, edita
 * e vê os desativados dele.
 */
const modelo = require("../models");
const { requisicaoInvalida, naoEncontrado, proibido, conflito } = require("../middlewares/erros");

const POPULARES = 4;

// "popular" não é coluna do banco: são os serviços ATIVOS mais agendados
async function idsPopulares() {
    const [contagem, todos] = await Promise.all([modelo.contarAgendamentosPorServico(), modelo.listarServicos()]);
    const ativos = new Set(todos.filter((s) => s.ativo).map((s) => s.id));
    return Object.entries(contagem)
        .filter(([id]) => ativos.has(Number(id)))
        .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
        .slice(0, POPULARES)
        .map(([id]) => Number(id));
}

const formatar = (s, populares) => ({
    id: s.id, profissionalId: s.profissionalId, nome: s.nome, categoria: s.categoria, descricao: s.descricao,
    duracaoMin: s.duracaoMin, preco: s.preco, ativo: s.ativo, popular: populares.includes(s.id)
});

// Valida os campos do corpo. "parcial" aceita só alguns campos (edição).
function validar(corpo, parcial) {
    const campos = {};
    const textos = { nome: 100, categoria: 50, descricao: 255 };
    for (const [campo, max] of Object.entries(textos)) {
        if (corpo[campo] === undefined) { if (!parcial) throw requisicaoInvalida(`Informe ${campo}.`); continue; }
        const valor = String(corpo[campo]).trim();
        if (!valor) throw requisicaoInvalida(`O campo ${campo} não pode ficar vazio.`);
        if (valor.length > max) throw requisicaoInvalida(`O campo ${campo} aceita até ${max} caracteres.`);
        campos[campo] = valor;
    }
    if (corpo.duracaoMin === undefined) { if (!parcial) throw requisicaoInvalida("Informe duracaoMin."); }
    else {
        const d = Number(corpo.duracaoMin);
        if (!Number.isInteger(d) || d < 5 || d > 600) throw requisicaoInvalida("A duração deve ser um número inteiro de 5 a 600 minutos.");
        campos.duracaoMin = d;
    }
    if (corpo.preco === undefined) { if (!parcial) throw requisicaoInvalida("Informe preco."); }
    else {
        const p = Number(corpo.preco);
        if (!Number.isFinite(p) || p < 0 || p > 99999999) throw requisicaoInvalida("O preço deve ser um número igual ou maior que zero.");
        campos.preco = Math.round(p * 100) / 100;
    }
    if (corpo.ativo !== undefined) {
        if (typeof corpo.ativo !== "boolean") throw requisicaoInvalida("O campo ativo deve ser verdadeiro ou falso.");
        campos.ativo = corpo.ativo;
    }
    return campos;
}

// GET /api/servicos?apenasAtivos=false&profissionalId=
async function listar(usuario, { apenasAtivos, profissionalId }) {
    const soAtivos = apenasAtivos !== "false";
    let filtroProfissional = profissionalId;
    if (!soAtivos) {
        // ver os desativados é só do dono
        if (!usuario || usuario.perfil !== "profissional" || !usuario.profissionalId) throw proibido("Só o profissional vê os serviços desativados.");
        if (profissionalId && Number(profissionalId) !== usuario.profissionalId) throw proibido("Você só vê os seus serviços.");
        filtroProfissional = usuario.profissionalId;
    }
    const [lista, populares] = await Promise.all([modelo.listarServicos({ profissionalId: filtroProfissional }), idsPopulares()]);
    return lista.filter((s) => !soAtivos || s.ativo).map((s) => formatar(s, populares));
}

// POST /api/servicos  (o serviço sempre pertence ao profissional logado; profissionalId do corpo é ignorado)
async function criar(usuario, corpo) {
    const campos = validar(corpo, false);
    const novo = await modelo.criarServico({ ...campos, ativo: campos.ativo ?? true, profissionalId: usuario.profissionalId });
    return formatar(novo, await idsPopulares());
}

// PUT /api/servicos/:id  (também ativa/desativa: { ativo: false })
async function atualizar(usuario, id, corpo) {
    const servico = await modelo.servicoPorId(id);
    if (!servico) throw naoEncontrado("Serviço não encontrado.");
    if (servico.profissionalId !== usuario.profissionalId) throw proibido("Este serviço não é seu.");
    const atualizado = await modelo.atualizarServico(servico.id, validar(corpo, true));
    return formatar(atualizado, await idsPopulares());
}

// DELETE /api/servicos/:id  Só exclui serviço que nunca foi agendado: o histórico de agendamentos
// precisa continuar mostrando o serviço. Os demais são desativados (PUT com { ativo: false }).
async function excluir(usuario, id) {
    const servico = await modelo.servicoPorId(id);
    if (!servico) throw naoEncontrado("Serviço não encontrado.");
    if (servico.profissionalId !== usuario.profissionalId) throw proibido("Este serviço não é seu.");
    if (await modelo.servicoTemAgendamentos(servico.id)) {
        throw conflito("Este serviço já tem agendamentos e não pode ser excluído. Desative-o para que não apareça mais aos clientes.");
    }
    await modelo.excluirServico(servico.id);
}

module.exports = { listar, criar, atualizar, excluir, formatar, idsPopulares };
