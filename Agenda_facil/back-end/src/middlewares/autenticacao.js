/*
 * Quem está chamando a API?
 *
 * AUTH_MODO=firebase (o real): o front-end envia "Authorization: Bearer <token do Firebase>".
 *     A API confere o token com o Firebase e procura o uid dele em usuario.firebase_uid.
 * AUTH_MODO=fake (desenvolvimento e testes, sem Firebase):
 *     - cabeçalho X-Usuario-Id: id de um usuário que já existe no banco; ou
 *     - "Authorization: Bearer teste:<uid>:<email>:<nome>": simula um token de alguém recém-cadastrado no Firebase
 *       (com "teste-verificado:" no lugar de "teste:", simula um e-mail já confirmado).
 *
 * Nos dois modos o resultado é o mesmo:
 *   req.tokenInfo = { uid, email, nome, emailVerificado }   quando há token (mesmo sem cadastro no sistema)
 *   req.usuario   = { id, nome, perfil, profissionalId? }   quando a pessoa já tem cadastro
 * As regras de negócio só usam req.usuario; elas nunca confiam em ids enviados no corpo da requisição.
 *
 * Aviso: o modo "fake" NUNCA deve ficar ligado em produção (qualquer pessoa se passaria por outra).
 */
const { authModo } = require("../config/env");
const modelo = require("../models");
const { naoAutenticado, proibido, cadastroIncompleto, emailJaCadastrado } = require("./erros");

function lerToken(req) {
    const m = (req.get("Authorization") || "").match(/^Bearer (.+)$/i);
    return m ? m[1] : null;
}

// Descobre { uid, email, nome, emailVerificado } a partir do token (ou null, se a requisição não trouxe nenhum)
async function lerIdentidadeDoToken(req) {
    const token = lerToken(req);
    if (!token) return null;
    if (authModo === "firebase") return require("../services/firebase.service").verificarToken(token);

    // modo fake: "teste:<uid>:<email>:<nome>" (ou "teste-verificado:..." para e-mail confirmado)
    const [prefixo, uid, email, ...nome] = token.split(":");
    if ((prefixo !== "teste" && prefixo !== "teste-verificado") || !uid) throw naoAutenticado("Token de teste inválido.");
    return { uid, email: email || null, nome: nome.join(":") || null, emailVerificado: prefixo === "teste-verificado" };
}

function comoIdentidade(usuario, profissional) {
    const identidade = { id: usuario.id, nome: usuario.nome, perfil: usuario.tipo };
    if (usuario.tipo === "profissional") identidade.profissionalId = profissional ? profissional.id : null;
    return identidade;
}

/*
 * Login novo do Firebase (uid sem conta) com o e-mail de uma conta que já existe no sistema.
 * Acontece quando a conta do Firebase é apagada no console e criada de novo: o Firebase dá um uid
 * novo, mas o cadastro (perfil, agendamentos, local) continua no banco com o uid antigo.
 * Só religa se o Firebase garantir que a pessoa é dona do e-mail (email_verified); sem isso,
 * qualquer um que criasse uma conta com aquele e-mail herdaria o cadastro de outra pessoa.
 */
async function religarPeloEmail(tokenInfo) {
    const existente = await modelo.usuarioPorEmail(tokenInfo.email);
    if (!existente) return null;
    if (!existente.ativo) throw proibido("Esta conta está desativada. Fale com o responsável pelo sistema.");
    if (!tokenInfo.emailVerificado) throw emailJaCadastrado();
    const religado = await modelo.religarFirebaseUid(existente.id, tokenInfo.uid);
    if (religado) console.info(`[auth] conta ${existente.id} (${existente.email}) ligada a um novo login do Firebase`);
    return religado;
}

async function identificar(req) {
    req.tokenInfo = await lerIdentidadeDoToken(req);
    let usuario = null;
    if (req.tokenInfo) {
        usuario = await modelo.usuarioPorFirebaseUid(req.tokenInfo.uid);
        if (!usuario && req.tokenInfo.email) usuario = await religarPeloEmail(req.tokenInfo);
    } else if (authModo === "fake" && req.get("X-Usuario-Id")) {
        usuario = await modelo.usuarioPorId(req.get("X-Usuario-Id"));
        if (!usuario) throw naoAutenticado("Usuário não encontrado.");
    }
    if (!usuario) return null;
    const profissional = usuario.tipo === "profissional" ? await modelo.profissionalPorUsuarioId(usuario.id) : null;
    return comoIdentidade(usuario, profissional);
}

// Exige login e cadastro completo
async function autenticar(req, res, next) {
    req.usuario = await identificar(req);
    if (req.usuario) {
        // Profissional sem o local cadastrado: sem profissionalId, os filtros "por dono" ficariam vazios
        // e a pessoa enxergaria dados de outros profissionais. Trata como cadastro incompleto.
        if (req.usuario.perfil === "profissional" && !req.usuario.profissionalId) throw cadastroIncompleto();
        return next();
    }
    if (req.tokenInfo) throw cadastroIncompleto();      // token válido, mas ainda sem cadastro no sistema
    throw naoAutenticado();
}

// Exige apenas um token válido (usado para criar o cadastro, que ainda não existe)
async function autenticarToken(req, res, next) {
    req.usuario = await identificar(req);
    if (!req.tokenInfo) throw naoAutenticado();
    next();
}

// Login opcional: rotas públicas que mostram mais coisas para quem está logado.
// Um token vencido ou inválido não pode impedir o acesso ao catálogo público: vira "visitante".
async function autenticarOpcional(req, res, next) {
    try {
        req.usuario = await identificar(req);
    } catch (erro) {
        req.usuario = null;
    }
    next();
}

// Exige um perfil específico (use depois de "autenticar")
const exigirPerfil = (perfil) => (req, res, next) => {
    if (req.usuario.perfil !== perfil) throw proibido(`Esta ação é só para ${perfil}.`);
    if (perfil === "profissional" && !req.usuario.profissionalId) throw proibido("Complete o cadastro de profissional para continuar.");
    next();
};

module.exports = { autenticar, autenticarToken, autenticarOpcional, exigirPerfil };
