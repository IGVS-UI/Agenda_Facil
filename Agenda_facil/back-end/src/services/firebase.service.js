/*
 * Confere o token (ID token) que o Firebase Authentication entregou ao navegador.
 * Se o token for válido, devolve quem é a pessoa: { uid, email, nome, emailVerificado }.
 *
 * Credenciais (só no .env, nunca no GitHub):
 *   FIREBASE_PROJECT_ID   id do projeto (ex.: projeto-ragozzinni)
 *   FIREBASE_CREDENCIAIS  caminho do JSON da chave de serviço (console do Firebase > Configurações do projeto
 *                         > Contas de serviço > Gerar nova chave privada)
 * Para testar SEM chave real, use o emulador do Firebase (FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099).
 */
const path = require("node:path");
const { firebase } = require("../config/env");
const { naoAutenticado } = require("../middlewares/erros");

let autenticador;
function auth() {
    if (!autenticador) {
        // só é carregado quando o login real é usado
        const { initializeApp, getApps, cert } = require("firebase-admin/app");
        const { getAuth } = require("firebase-admin/auth");
        const app = getApps()[0] || initializeApp({
            projectId: firebase.projectId || undefined,
            ...(firebase.credenciais ? { credential: cert(require(path.resolve(firebase.credenciais))) } : {})
        });
        autenticador = getAuth(app);
    }
    return autenticador;
}

async function verificarToken(token) {
    try {
        const d = await auth().verifyIdToken(token);
        return { uid: d.uid, email: d.email || null, nome: d.name || null, emailVerificado: d.email_verified === true };
    } catch (erro) {
        // erro de configuração (chave/projeto errados) aparece no terminal da API; para o cliente, é sempre "sessão inválida"
        if (erro.code !== "auth/argument-error" && erro.code !== "auth/id-token-expired") {
            console.error(`[firebase] token recusado (${erro.code || erro.name}): ${erro.message}`);
        }
        throw naoAutenticado("Sessão inválida ou expirada. Entre novamente.");
    }
}

module.exports = { verificarToken };
