/*
 * Inicia a API:   npm start   (ou npm run dev, que reinicia ao salvar)
 */
const config = require("./config/env");

async function iniciar() {
    // 1) Configuração: nada perigoso (ex.: login fake em produção) pode subir
    const { erros, avisos } = config.validarConfiguracao();
    avisos.forEach((aviso) => console.warn(`\n⚠  ATENÇÃO: ${aviso}`));
    if (erros.length) {
        erros.forEach((erro) => console.error(`\n✗  ${erro}`));
        console.error("\nA API não foi iniciada. Corrija o arquivo .env.\n");
        process.exit(1);
    }

    // 2) Banco: no modo MySQL, falha logo aqui se o banco não estiver acessível
    const app = require("./app");
    const modelo = require("./models");
    try {
        await modelo.verificarConexao();
    } catch (erro) {
        console.error(`Não foi possível conectar ao banco "${config.bd.database}" em ${config.bd.host}:${config.bd.port}.`);
        console.error(`Motivo: ${erro.message}`);
        console.error("Confira DB_HOST, DB_PORT, DB_USER, DB_PASSWORD e DB_NAME no arquivo .env e se o MySQL está ligado.");
        process.exit(1);
    }

    app.listen(config.porta, () => {
        console.log(`\nAPI do Agenda Fácil em http://localhost:${config.porta}/api  (dados: ${config.dadosModo}, login: ${config.authModo})`);
    });
}
iniciar();
