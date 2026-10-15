/*
 * Configuração da API, lida das variáveis de ambiente (arquivo .env).
 * O "npm start" carrega o .env sozinho (node --env-file-if-exists=.env).
 */
/*
 * Fuso horário: "já passou?" e "que dia da semana é?" dependem dele. Sem isto, um servidor em UTC
 * recusaria horários que ainda são futuros no Brasil. Padrão: Brasília (mude com TZ no .env).
 * Precisa vir antes de qualquer cálculo de data; o Node aplica o TZ assim que ele é definido.
 */
process.env.TZ = process.env.TZ || "America/Sao_Paulo";

const config = {
    fusoHorario: process.env.TZ,
    ambiente: process.env.NODE_ENV || "development",   // "production" no servidor de verdade
    porta: Number(process.env.PORT) || 3000,
    corsOrigem: process.env.CORS_ORIGEM || "*",
    authModo: process.env.AUTH_MODO || "fake",       // "fake" | "firebase"
    // Busca por proximidade: raio padrão (km) e serviço de geocodificação ("nominatim" | "desligada")
    raioBuscaKm: Number(process.env.RAIO_BUSCA_KM) || 30,
    geocodificacao: process.env.GEOCODIFICACAO || "nominatim",
    // Até quantos dias à frente o cliente pode agendar
    limiteDiasAgendamento: Number(process.env.LIMITE_DIAS_AGENDAMENTO) || 90,
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

/*
 * Confere a configuração antes de a API subir.
 *   erros  -> a API NÃO sobe (configuração perigosa ou inválida)
 *   avisos -> a API sobe, mas mostra o alerta no terminal
 */
function validarConfiguracao(c = config) {
    const erros = [], avisos = [];
    const producao = c.ambiente === "production";

    if (!["fake", "firebase"].includes(c.authModo)) erros.push(`AUTH_MODO inválido: "${c.authModo}". Use "fake" ou "firebase".`);
    if (c.geocodificacao && !["nominatim", "desligada"].includes(c.geocodificacao)) erros.push(`GEOCODIFICACAO inválida: "${c.geocodificacao}". Use "nominatim" ou "desligada".`);
    if (!["memoria", "mysql"].includes(c.dadosModo)) erros.push(`DADOS_MODO inválido: "${c.dadosModo}". Use "memoria" ou "mysql".`);

    if (c.authModo === "fake") {
        // No modo fake qualquer pessoa diz quem é pelo cabeçalho X-Usuario-Id: nunca pode ir para produção
        if (producao) erros.push("AUTH_MODO=fake não pode ser usado em produção (qualquer pessoa se passaria por outra). Use AUTH_MODO=firebase.");
        else avisos.push("AUTH_MODO=fake: login de DESENVOLVIMENTO ligado (qualquer um escolhe o usuário pelo cabeçalho X-Usuario-Id). Não publique assim.");
    }
    if (c.authModo === "firebase" && !c.firebase.projectId) erros.push("AUTH_MODO=firebase precisa de FIREBASE_PROJECT_ID.");
    if (c.firebase.credenciais && !require("node:fs").existsSync(require("node:path").resolve(c.firebase.credenciais))) {
        erros.push(`FIREBASE_CREDENCIAIS aponta para um arquivo que não existe: ${c.firebase.credenciais}. Corrija o caminho ou apague a linha (a chave é opcional).`);
    }
    if (producao && c.corsOrigem === "*") avisos.push('CORS_ORIGEM="*" em produção libera qualquer site a chamar a API. Informe o endereço do front-end.');

    return { erros, avisos };
}

module.exports = { ...config, validarConfiguracao };
