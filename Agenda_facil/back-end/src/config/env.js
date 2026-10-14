/*
 * Configuração da API, lida das variáveis de ambiente (arquivo .env).
 * O "npm start" carrega o .env sozinho (node --env-file-if-exists=.env).
 */
module.exports = {
    porta: Number(process.env.PORT) || 3000,
    corsOrigem: process.env.CORS_ORIGEM || "*",
    authModo: process.env.AUTH_MODO || "fake",       // "fake" | "firebase"
    dadosModo: process.env.DADOS_MODO || "memoria",  // "memoria" | "mysql"
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || "",
        // caminho do arquivo JSON da chave de serviço (nunca versionar). Com o emulador do Firebase não é necessário.
        credenciais: process.env.FIREBASE_CREDENCIAIS || ""
    },
    bd: {
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "Agenda_Facil"
    }
};
