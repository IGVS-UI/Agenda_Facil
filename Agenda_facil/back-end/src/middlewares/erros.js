/*
 * Erros da API: os serviços lançam ErroApi(status, mensagem) e o tratador abaixo
 * transforma em resposta JSON { mensagem } com o código HTTP certo.
 */
class ErroApi extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}

const naoAutenticado = (mensagem = "Você precisa entrar para continuar.") => new ErroApi(401, mensagem);
const proibido = (mensagem = "Você não tem permissão para fazer isto.") => new ErroApi(403, mensagem);
const naoEncontrado = (mensagem = "Não encontrado.") => new ErroApi(404, mensagem);
const requisicaoInvalida = (mensagem) => new ErroApi(400, mensagem);
const conflito = (mensagem) => new ErroApi(409, mensagem);

function rotaNaoEncontrada(req, res, next) {
    next(naoEncontrado(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
}

// Precisa ter 4 parâmetros para o Express reconhecer como tratador de erros
// eslint-disable-next-line no-unused-vars
function tratarErros(erro, req, res, next) {
    if (erro instanceof ErroApi) return res.status(erro.status).json({ mensagem: erro.message });
    if (erro instanceof SyntaxError && erro.status === 400) return res.status(400).json({ mensagem: "JSON inválido no corpo da requisição." });
    console.error(erro);
    res.status(500).json({ mensagem: "Erro interno do servidor." });
}

module.exports = { ErroApi, naoAutenticado, proibido, naoEncontrado, requisicaoInvalida, conflito, rotaNaoEncontrada, tratarErros };
