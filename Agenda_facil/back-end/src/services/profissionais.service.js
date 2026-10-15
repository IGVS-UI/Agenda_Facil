/*
 * Profissionais e locais, ordenados por distância do cliente.
 * A distância é calculada AQUI (Haversine) a partir da latitude/longitude do cliente e do local.
 * O front só envia a posição do cliente e mostra o distanciaKm que recebe.
 */
const modelo = require("../models");
const geocodificacao = require("./geocodificacao.service");
const { raioBuscaKm } = require("../config/env");
const { requisicaoInvalida, naoEncontrado } = require("../middlewares/erros");

// Posições de exemplo para testar sem GPS (o front mostra o seletor "Estou em")
const ORIGENS = [
    { id: "centro", nome: "Centro", latitude: -23.5560, longitude: -46.6530 },
    { id: "jardim", nome: "Jardim América", latitude: -23.5668, longitude: -46.6590 },
    { id: "vila", nome: "Vila Nova", latitude: -23.5720, longitude: -46.6440 }
];

const RAIO_TERRA_KM = 6371;
const radianos = (graus) => (graus * Math.PI) / 180;

function distanciaKm(lat1, lon1, lat2, lon2) {
    const dLat = radianos(lat2 - lat1), dLon = radianos(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radianos(lat1)) * Math.cos(radianos(lat2)) * Math.sin(dLon / 2) ** 2;
    return RAIO_TERRA_KM * 2 * Math.asin(Math.sqrt(a));
}

// Descobre a posição do cliente: ?origem=centro  OU  ?latitude=..&longitude=..
function resolverPosicao({ origem, latitude, longitude }) {
    if (origem) {
        const o = ORIGENS.find((x) => x.id === origem);
        if (!o) throw requisicaoInvalida(`Origem desconhecida: ${origem}.`);
        return { latitude: o.latitude, longitude: o.longitude };
    }
    if (latitude !== undefined || longitude !== undefined) {
        const lat = Number(latitude), lon = Number(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
            throw requisicaoInvalida("Latitude/longitude inválidas.");
        }
        return { latitude: lat, longitude: lon };
    }
    return null;
}

const listarOrigens = () => ORIGENS.map(({ id, nome }) => ({ id, nome }));

// GET /api/profissionais?servicoId=&latitude=&longitude=&raioKm=   (ou ?origem=, posições de exemplo)
// Com a posição do cliente: só os locais até "raioKm" (padrão RAIO_BUSCA_KM), do mais perto ao mais longe.
async function listar({ servicoId, raioKm, ...localizacao }) {
    const posicao = resolverPosicao(localizacao);
    const raio = raioKm === undefined ? raioBuscaKm : Number(raioKm);
    if (!Number.isFinite(raio) || raio <= 0 || raio > 500) throw requisicaoInvalida("O raio deve ser um número entre 1 e 500 km.");
    const [profissionais, servicos] = await Promise.all([modelo.listarProfissionais(), modelo.listarServicos()]);
    const ativos = servicos.filter((s) => s.ativo);

    const lista = [];
    for (const p of profissionais) {
        const usuario = await modelo.usuarioPorId(p.usuarioId);
        const servicosIds = ativos.filter((s) => s.profissionalId === p.id).map((s) => s.id);
        if (servicoId && !servicosIds.includes(Number(servicoId))) continue;
        lista.push({
            id: p.id,
            nome: usuario.nome,
            local: p.nomeLocal,
            endereco: `${p.logradouro}, ${p.numero} - ${p.bairro}`,
            distanciaKm: posicao && p.latitude != null && p.longitude != null
                ? Math.round(distanciaKm(posicao.latitude, posicao.longitude, p.latitude, p.longitude) * 10) / 10 : null,
            avaliacao: p.avaliacao,
            servicosIds
        });
    }
    if (!posicao) return lista.sort((a, b) => a.local.localeCompare(b.local));
    // Com posição: fora ficam os locais sem coordenadas (não dá para saber a distância) e os além do raio
    return lista
        .filter((p) => p.distanciaKm !== null && p.distanciaKm <= raio)
        .sort((a, b) => a.distanciaKm - b.distanciaKm);
}

// GET /api/localizacao?cep=  -> posição aproximada de um CEP (quando o cliente não quer usar o GPS)
async function localizacaoDoCep({ cep }) {
    if (String(cep || "").replace(/\D/g, "").length !== 8) throw requisicaoInvalida("Informe um CEP com 8 números.");
    const ponto = await geocodificacao.coordenadasDoCep(cep);
    if (!ponto) throw naoEncontrado("Não encontramos este CEP. Confira os números ou use a sua localização.");
    return ponto;
}

module.exports = { listar, listarOrigens, localizacaoDoCep };
