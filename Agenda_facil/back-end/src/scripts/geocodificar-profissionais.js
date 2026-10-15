/*
 * Preenche as coordenadas dos profissionais que ainda não têm (ex.: cadastrados antes desta função,
 * ou quando a internet estava fora do ar no cadastro):   npm run geocodificar
 * Usa o mesmo .env da API (DADOS_MODO=mysql para gravar no banco).
 */
const modelo = require("../models");
const geocodificacao = require("../services/geocodificacao.service");

(async () => {
    const semCoordenadas = (await modelo.listarProfissionais()).filter((p) => p.latitude == null || p.longitude == null);
    console.log(`\n${semCoordenadas.length} profissional(is) sem coordenadas.\n`);
    for (const p of semCoordenadas) {
        const ponto = await geocodificacao.coordenadasDoEndereco(p);
        if (ponto) {
            await modelo.atualizarLocalizacaoDoProfissional(p.id, ponto.latitude, ponto.longitude);
            console.log(`  ✓ ${p.nomeLocal}: ${ponto.latitude.toFixed(5)}, ${ponto.longitude.toFixed(5)} (precisão: ${ponto.precisao})`);
        } else {
            console.log(`  ✗ ${p.nomeLocal}: endereço não encontrado (confira CEP, rua e número)`);
        }
    }
    await modelo.encerrar();
    console.log("");
})().catch(async (erro) => { console.error(erro.message); await modelo.encerrar(); process.exitCode = 1; });
