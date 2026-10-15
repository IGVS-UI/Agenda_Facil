/*
 * Geocodificação: transforma CEP/endereço em coordenadas (latitude e longitude).
 *
 * Usa dois serviços GRATUITOS e sem chave:
 *   ViaCEP (viacep.com.br)                 -> CEP vira rua, bairro, cidade e UF
 *   Nominatim / OpenStreetMap (nominatim.openstreetmap.org) -> endereço vira coordenadas
 * Regras de uso do Nominatim: no máximo 1 pedido por segundo e identificar o sistema (User-Agent).
 * Por isso os pedidos aqui são feitos em fila, com intervalo mínimo entre eles.
 *
 * GEOCODIFICACAO=desligada (testes e uso sem internet): nada é consultado e o resultado é "sem coordenadas".
 * Nunca impede um cadastro: se não encontrar, o local fica sem coordenadas (e não aparece na busca por proximidade).
 */
const { geocodificacao } = require("../config/env");

const USER_AGENT = "AgendaFacil/1.0 (projeto academico)";
const INTERVALO_MS = 1100;          // > 1 segundo entre pedidos ao Nominatim
const TEMPO_LIMITE_MS = 8000;

let fila = Promise.resolve();
let ultimoPedido = 0;

async function buscarJson(url) {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
    try {
        const resposta = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" }, signal: controle.signal });
        return resposta.ok ? resposta.json() : null;
    } catch (erro) {
        return null;                     // sem internet ou serviço fora do ar: segue sem coordenadas
    } finally {
        clearTimeout(relogio);
    }
}

// Um pedido por vez ao Nominatim, respeitando o intervalo mínimo
function nominatim(parametros) {
    const tarefa = fila.then(async () => {
        const espera = ultimoPedido + INTERVALO_MS - Date.now();
        if (espera > 0) await new Promise((ok) => setTimeout(ok, espera));
        ultimoPedido = Date.now();
        const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "br", ...parametros })}`;
        const lista = await buscarJson(url);
        return Array.isArray(lista) && lista[0] ? { latitude: Number(lista[0].lat), longitude: Number(lista[0].lon) } : null;
    });
    fila = tarefa.catch(() => {});
    return tarefa;
}

// CEP -> { logradouro, bairro, cidade, uf }  (ou null se o CEP não existir)
async function enderecoDoCep(cep) {
    const numeros = String(cep || "").replace(/\D/g, "");
    if (numeros.length !== 8 || geocodificacao === "desligada") return null;
    const dados = await buscarJson(`https://viacep.com.br/ws/${numeros}/json/`);
    if (!dados || dados.erro) return null;
    return { logradouro: dados.logradouro || "", bairro: dados.bairro || "", cidade: dados.localidade || "", uf: dados.uf || "" };
}

/*
 * Endereço -> { latitude, longitude, precisao }   precisao: "endereco" | "rua" | "cidade"
 * Tenta do mais preciso para o menos preciso. Devolve null se nada for encontrado.
 */
async function coordenadasDoEndereco({ cep, logradouro, numero, cidade, uf }) {
    if (geocodificacao === "desligada") return null;
    // completa com o ViaCEP o que faltar (ou corrigir a cidade/UF de acordo com o CEP)
    const doCep = await enderecoDoCep(cep);
    const rua = logradouro || (doCep && doCep.logradouro);
    const municipio = (doCep && doCep.cidade) || cidade;
    const estado = (doCep && doCep.uf) || uf;
    if (!municipio || !estado) return null;

    const tentativas = [];
    if (rua && numero && !/^s\/?n$/i.test(numero)) tentativas.push(["endereco", { street: `${numero} ${rua}`, city: municipio, state: estado }]);
    if (rua) tentativas.push(["rua", { street: rua, city: municipio, state: estado }]);
    tentativas.push(["cidade", { city: municipio, state: estado }]);

    for (const [precisao, parametros] of tentativas) {
        const ponto = await nominatim(parametros);
        if (ponto) return { ...ponto, precisao };
    }
    return null;
}

// CEP -> { latitude, longitude, precisao, descricao }  (usado quando o cliente informa o CEP em vez do GPS)
async function coordenadasDoCep(cep) {
    const endereco = await enderecoDoCep(cep);
    if (!endereco) return null;
    const ponto = await coordenadasDoEndereco({ cep, ...endereco });
    if (!ponto) return null;
    const partes = [endereco.logradouro, endereco.bairro, `${endereco.cidade}/${endereco.uf}`].filter(Boolean);
    return { ...ponto, descricao: partes.join(", ") };
}

module.exports = { coordenadasDoEndereco, coordenadasDoCep, enderecoDoCep };
