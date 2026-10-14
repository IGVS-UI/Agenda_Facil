/*
 * Inicia a API:   npm start   (ou npm run dev, que reinicia ao salvar)
 */
const app = require("./app");
const config = require("./config/env");
const modelo = require("./models");

async function iniciar() {
    try {
        await modelo.verificarConexao();     // no modo MySQL, falha logo aqui se o banco não estiver acessível
    } catch (erro) {
        console.error(`Não foi possível conectar ao banco "${config.bd.database}" em ${config.bd.host}:${config.bd.port}.`);
        console.error(`Motivo: ${erro.message}`);
        console.error("Confira DB_HOST, DB_PORT, DB_USER, DB_PASSWORD e DB_NAME no arquivo .env e se o MySQL está ligado.");
        process.exit(1);
    }
    app.listen(config.porta, () => {
        console.log(`API do Agenda Fácil em http://localhost:${config.porta}/api  (dados: ${config.dadosModo}, login: ${config.authModo})`);
    });
}
iniciar();
