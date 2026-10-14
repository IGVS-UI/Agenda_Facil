/*
 * Quem está chamando a API?
 *
 * AUTH_MODO=fake      (hoje, só desenvolvimento): o cabeçalho X-Usuario-Id diz qual usuário do banco é.
 * AUTH_MODO=firebase  (integração): o cabeçalho "Authorization: Bearer <token>" é conferido com o
 *                     Firebase Admin e o uid do token é procurado em usuario.firebase_uid.
 *
 * Nos dois casos o resultado é o mesmo: req.usuario = { id, nome, perfil, profissionalId? }.
 * As regras de negócio só usam req.usuario; elas nunca confiam em ids enviados no corpo da requisição.
 */
const { authModo } = require("../config/env");
const modelo = require("../models");
const { naoAutenticado, proibido } = require("./erros");

async function identificar(req) {
    if (authModo === "firebase") {
        throw new Error("AUTH_MODO=firebase ainda não foi implementado. Use AUTH_MODO=fake.");
    }
    const id = req.get("X-Usuario-Id");
    if (!id) return null;
    const usuario = await modelo.usuarioPorId(id);
    if (!usuario) throw naoAutenticado("Usuário não encontrado.");

    const identidade = { id: usuario.id, nome: usuario.nome, perfil: usuario.tipo };
    if (usuario.tipo === "profissional") {
        const profissional = await modelo.profissionalPorUsuarioId(usuario.id);
        identidade.profissionalId = profissional ? profissional.id : null;
    }
    return identidade;
}

// Exige login
async function autenticar(req, res, next) {
    req.usuario = await identificar(req);
    if (!req.usuario) throw naoAutenticado();
    next();
}

// Login opcional: rotas públicas que mostram mais coisas para quem está logado
async function autenticarOpcional(req, res, next) {
    req.usuario = await identificar(req);
    next();
}

// Exige um perfil específico (use depois de "autenticar")
const exigirPerfil = (perfil) => (req, res, next) => {
    if (req.usuario.perfil !== perfil) throw proibido(`Esta ação é só para ${perfil}.`);
    if (perfil === "profissional" && !req.usuario.profissionalId) throw proibido("Complete o cadastro de profissional para continuar.");
    next();
};

module.exports = { autenticar, autenticarOpcional, exigirPerfil };
