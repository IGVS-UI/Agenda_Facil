/*
 * Erros da API: os serviços lançam ErroApi(status, mensagem) e o tratador abaixo
 * transforma em resposta JSON { mensagem } com o código HTTP certo.
 */
class ErroApi extends Error {
    // "codigo" é opcional: um texto curto que o front-end pode testar (ex.: CADASTRO_INCOMPLETO)
    constructor(status, mensagem, codigo) {
        super(mensagem);
        this.status = status;
        this.codigo = codigo;
    }
}

const naoAutenticado = (mensagem = "Você precisa entrar para continuar.") => new ErroApi(401, mensagem);
const proibido = (mensagem = "Você não tem permissão para fazer isto.") => new ErroApi(403, mensagem);
const naoEncontrado = (mensagem = "Não encontrado.") => new ErroApi(404, mensagem);
const requisicaoInvalida = (mensagem) => new ErroApi(400, mensagem);
const conflito = (mensagem) => new ErroApi(409, mensagem);
// Token do Firebase válido, mas a pessoa ainda não tem cadastro no sistema (ex.: primeiro login com Google)
const cadastroIncompleto = () => new ErroApi(403, "Conclua o seu cadastro para continuar.", "CADASTRO_INCOMPLETO");
// O e-mail do token já tem cadastro no sistema, mas ligado a OUTRO login do Firebase (ex.: a conta foi apagada
// no console e criada de novo). Só religa depois que o Firebase confirmar que a pessoa é dona do e-mail.
const emailJaCadastrado = () => new ErroApi(409,
    "Este e-mail já tem um cadastro no Agenda Fácil, ligado a outro login. Confirme o e-mail para usar este login no seu cadastro.",
    "EMAIL_JA_CADASTRADO");

function rotaNaoEncontrada(req, res, next) {
    next(naoEncontrado(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
}

// Precisa ter 4 parâmetros para o Express reconhecer como tratador de erros
// eslint-disable-next-line no-unused-vars
function tratarErros(erro, req, res, next) {
    if (erro instanceof ErroApi) return res.status(erro.status).json({ mensagem: erro.message, ...(erro.codigo ? { codigo: erro.codigo } : {}) });
    if (erro instanceof SyntaxError && erro.status === 400) return res.status(400).json({ mensagem: "JSON inválido no corpo da requisição." });
    console.error(erro);
    res.status(500).json({ mensagem: "Erro interno do servidor." });
}

module.exports = { ErroApi, naoAutenticado, proibido, naoEncontrado, requisicaoInvalida, conflito, cadastroIncompleto, emailJaCadastrado, rotaNaoEncontrada, tratarErros };
