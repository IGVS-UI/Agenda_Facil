/*
 * Cadastro: cria a conta no sistema para quem já existe no Firebase Authentication.
 *
 * Fluxo: o front cria a pessoa no Firebase (e-mail/senha ou Google) e recebe um token; então chama
 * POST /api/usuarios com esse token e com os dados do cadastro. O perfil (cliente ou profissional)
 * é decidido AQUI e fica gravado no banco: o front-end nunca decide sozinho quem é profissional.
 *
 * O e-mail vem SEMPRE do token (conferido pelo Firebase), nunca do corpo da requisição.
 */
const modelo = require("../models");
const geocodificacao = require("./geocodificacao.service");
const { requisicaoInvalida, conflito, emailJaCadastrado } = require("../middlewares/erros");

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

function texto(corpo, campo, { max, obrigatorio = true, rotulo = campo } = {}) {
    const valor = corpo[campo] === undefined || corpo[campo] === null ? "" : String(corpo[campo]).trim();
    if (!valor) { if (obrigatorio) throw requisicaoInvalida(`Informe ${rotulo}.`); return null; }
    if (max && valor.length > max) throw requisicaoInvalida(`${rotulo[0].toUpperCase()}${rotulo.slice(1)} aceita até ${max} caracteres.`);
    return valor;
}

function validarProfissional(dados, telefone) {
    if (!dados || typeof dados !== "object") throw requisicaoInvalida("Informe os dados do profissional.");
    const cep = String(dados.cep || "").replace(/\D/g, "");
    if (cep.length !== 8) throw requisicaoInvalida("O CEP deve ter 8 números.");
    const uf = String(dados.uf || "").toUpperCase();
    if (!UFS.includes(uf)) throw requisicaoInvalida("Escolha um estado (UF) válido.");
    return {
        especialidade: texto(dados, "especialidade", { max: 100, rotulo: "o serviço que você oferece" }),
        nomeLocal: texto(dados, "nomeLocal", { max: 120, rotulo: "o nome do local de atendimento" }),
        celular: telefone,
        cep,
        logradouro: texto(dados, "logradouro", { max: 150, rotulo: "o endereço" }),
        numero: texto(dados, "numero", { max: 10, rotulo: "o número" }),
        complemento: texto(dados, "complemento", { max: 80, obrigatorio: false }),
        bairro: texto(dados, "bairro", { max: 80, rotulo: "o bairro" }),
        cidade: texto(dados, "cidade", { max: 80, rotulo: "a cidade" }),
        uf,
        // latitude/longitude: preenchidas pela geocodificação (logo abaixo, em "criar")
        latitude: null,
        longitude: null
    };
}

// POST /api/usuarios   { perfil, nome, telefone, profissional?: { ... } }
// "jaCadastrado": a conta que a autenticação já encontrou para este token (se houver)
async function criar(tokenInfo, corpo, jaCadastrado) {
    if (jaCadastrado) throw conflito("Esta conta já está cadastrada. Entre para continuar.");
    if (!tokenInfo.email) throw requisicaoInvalida("A conta do Firebase precisa ter um e-mail.");
    if (corpo.perfil !== "cliente" && corpo.perfil !== "profissional") throw requisicaoInvalida('Escolha o perfil: "cliente" ou "profissional".');

    const nome = texto(corpo, "nome", { max: 100, rotulo: "o seu nome" });
    const telefone = texto(corpo, "telefone", { max: 20, rotulo: "o telefone", obrigatorio: corpo.perfil === "profissional" });
    const profissional = corpo.perfil === "profissional" ? validarProfissional(corpo.profissional, telefone) : null;

    if (await modelo.usuarioPorFirebaseUid(tokenInfo.uid)) throw conflito("Esta conta já está cadastrada. Entre para continuar.");
    // (a autenticação já religa a conta quando o e-mail está confirmado; aqui sobra o caso sem confirmação)
    if (await modelo.usuarioPorEmail(tokenInfo.email)) throw emailJaCadastrado();

    // Endereço -> coordenadas, para o local aparecer na busca por proximidade. Se não achar, o cadastro
    // continua (o local fica sem coordenadas e pode ser corrigido depois com "npm run geocodificar").
    if (profissional) {
        const ponto = await geocodificacao.coordenadasDoEndereco(profissional);
        if (ponto) Object.assign(profissional, { latitude: ponto.latitude, longitude: ponto.longitude });
    }

    try {
        const { usuario, profissional: local } = await modelo.criarConta({
            usuario: { firebaseUid: tokenInfo.uid, nome, email: tokenInfo.email, telefone, tipo: corpo.perfil },
            profissional
        });
        return { id: usuario.id, nome: usuario.nome, perfil: usuario.tipo, ...(local ? { profissionalId: local.id } : {}) };
    } catch (erro) {
        // dois cadastros iguais ao mesmo tempo: o UNIQUE do banco recusa o segundo
        if (erro.code === "ER_DUP_ENTRY") throw /email/i.test(erro.sqlMessage || "") ? emailJaCadastrado() : conflito("Esta conta já está cadastrada. Entre para continuar.");
        throw erro;
    }
}

module.exports = { criar };
