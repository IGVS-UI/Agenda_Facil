/*
 * authService: única porta de entrada do front-end para login, cadastro e sessão.
 * (Mesmo padrão do apiService: as páginas não sabem se é simulação ou Firebase de verdade.)
 *
 *   modo "mock"     -> nada é conferido; o login/cadastro das páginas é só simulado (como antes)
 *   modo "firebase" -> Firebase Authentication de verdade + a API (Node/Express) guarda o perfil
 *
 * Como ligar: abra qualquer página com ?auth=firebase (volta com ?auth=mock). A escolha fica na aba.
 * O modo firebase precisa da API ligada (use também ?api=http) e de AUTH_MODO=firebase no back-end.
 *
 * Fluxos (o perfil cliente/profissional é decidido e guardado no BANCO, via API; nunca só no navegador):
 *   cadastrar: cria a pessoa no Firebase -> recebe o token -> POST /api/usuarios (cria a conta no sistema)
 *   entrar:    entra no Firebase -> recebe o token -> GET /api/me (descobre o perfil)
 *              se não houver conta no sistema (ex.: 1º login com Google) -> "cadastro incompleto"
 *   vincular:  o e-mail já tem cadastro no sistema, mas ligado a OUTRO login do Firebase (a conta foi apagada
 *              no console e criada de novo). A pessoa confirma o e-mail pelo link do Firebase e a API religa
 *              o cadastro antigo a este login (sem confirmar, não religa: protege a conta de outra pessoa).
 *
 * Carregue como módulo:  <script type="module" src="../js/authService.js"></script>
 * (depois do apiService.js e do comum.js).
 */

const CHAVE_MODO = "agendaFacil:authModo";
function escolherModo() {
    const padrao = "mock";   // troque para "firebase" quando o login real for o padrão
    try {
        const pedido = new URLSearchParams(location.search).get("auth");
        if (pedido === "firebase" || pedido === "mock") sessionStorage.setItem(CHAVE_MODO, pedido);
        return sessionStorage.getItem(CHAVE_MODO) || padrao;
    } catch (erro) {
        return padrao;
    }
}
const modo = escolherModo();

// Páginas de cada perfil (caminhos a partir de Pages/)
const HOME = { cliente: "servicos_usuario.html", profissional: "agendamentos_profissional.html" };
const LOGIN = "autentificação/login.html";
const CADASTRO_CONCLUIR = "autentificação/cadastro.html?concluir=1";

let firebase = null;
async function carregarFirebase() {
    if (!firebase) firebase = await import("../firebase/firebase.js");   // só baixa o Firebase no modo firebase
    return firebase;
}

// Quem está logado no Firebase agora? (espera o Firebase terminar de restaurar a sessão)
async function usuarioFirebase() {
    const fb = await carregarFirebase();
    return new Promise((resolver) => {
        const parar = fb.onAuthStateChanged(fb.auth, (usuario) => { parar(); resolver(usuario); });
    });
}

// Token (ID token) que prova para a API quem é a pessoa. O Firebase renova sozinho quando vence.
async function obterToken() {
    if (modo !== "firebase") return null;
    const usuario = (await carregarFirebase()).auth.currentUser || await usuarioFirebase();
    return usuario ? usuario.getIdToken() : null;
}

/* ---------- Perfil (vem da API/banco) ---------- */

// { id, nome, perfil, profissionalId? }, ou { incompleto: true } quando só falta concluir o cadastro,
// ou { vincular: true } quando o e-mail já tem cadastro ligado a outro login (falta confirmar o e-mail)
async function meuPerfil() {
    try {
        return await requisicao("GET", "/me");
    } catch (erro) {
        if (erro.codigoApi === "CADASTRO_INCOMPLETO") return { incompleto: true };
        if (erro.codigoApi === "EMAIL_JA_CADASTRADO") return { vincular: true };
        throw erro;
    }
}

/* ---------- Religar um cadastro antigo a este login (confirmação de e-mail) ---------- */

// Envia o link de confirmação do Firebase (uma vez por aba, para não esbarrar no limite de envios; "reenviar" força)
async function enviarConfirmacaoDeEmail({ reenviar = false } = {}) {
    const fb = await carregarFirebase();
    const usuario = fb.auth.currentUser || await usuarioFirebase();
    if (!usuario) throw new Error("Entre novamente para continuar.");
    const chave = `agendaFacil:confirmacaoEnviada:${usuario.uid}`;
    let jaEnviado = false;
    try { jaEnviado = sessionStorage.getItem(chave) === "1"; } catch (erro) { /* sem sessionStorage */ }
    if (!jaEnviado || reenviar) {
        await fb.sendEmailVerification(usuario);
        try { sessionStorage.setItem(chave, "1"); } catch (erro) { /* sem sessionStorage */ }
    }
    return usuario.email;
}

// Depois de clicar no link: pega um token novo (agora com o e-mail confirmado) e pergunta de novo à API
async function conferirConfirmacaoDeEmail() {
    const usuario = (await carregarFirebase()).auth.currentUser || await usuarioFirebase();
    if (!usuario) throw new Error("Entre novamente para continuar.");
    await usuario.reload();
    await usuario.getIdToken(true);
    return meuPerfil();
}

/* ---------- Entrar, cadastrar, sair ---------- */

async function entrar(email, senha) {
    const fb = await carregarFirebase();
    await fb.signInWithEmailAndPassword(fb.auth, email, senha);
    return meuPerfil();
}

async function entrarComGoogle() {
    const fb = await carregarFirebase();
    await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider());
    return meuPerfil();                       // 1º login com Google => { incompleto: true }
}

/*
 * dados: { perfil, nome, telefone, profissional?: { especialidade, nomeLocal, cep, logradouro, numero, complemento, bairro, cidade, uf } }
 * Se a API recusar os dados DEPOIS de a conta existir no Firebase, a pessoa fica com login mas sem cadastro:
 * ao entrar, cai em "concluir cadastro" e termina de preencher. Nada se perde.
 */
async function concluirCadastro(dados) {
    try {
        return await requisicao("POST", "/usuarios", dados);
    } catch (erro) {
        if (erro.codigoApi === "EMAIL_JA_CADASTRADO") return { vincular: true };
        throw erro;
    }
}

async function cadastrar(email, senha, dados) {
    const fb = await carregarFirebase();
    const credencial = await fb.createUserWithEmailAndPassword(fb.auth, email, senha);
    try { await fb.updateProfile(credencial.user, { displayName: dados.nome }); } catch (erro) { /* só enfeite */ }
    return concluirCadastro(dados);
}

async function nomeSugerido() {
    const usuario = modo === "firebase" ? await usuarioFirebase() : null;
    return usuario ? { nome: usuario.displayName || "", email: usuario.email || "" } : { nome: "", email: "" };
}

async function sair() {
    if (modo !== "firebase") return;
    const fb = await carregarFirebase();
    await fb.signOut(fb.auth);
}

// Sempre responde igual, exista ou não a conta (não revela quais e-mails estão cadastrados)
async function recuperarSenha(email) {
    const fb = await carregarFirebase();
    try {
        await fb.sendPasswordResetEmail(fb.auth, email);
    } catch (erro) {
        if (erro.code !== "auth/user-not-found") throw erro;
    }
}

/* ---------- Páginas protegidas ---------- */

/*
 * Chamada no início de cada página interna: só deixa seguir quem está logado COM o perfil certo.
 * Sem login -> tela de login. Perfil errado -> a home do perfil dela. Sem cadastro -> concluir cadastro.
 * (Isto é conforto; a proteção de verdade dos dados é da API, que confere o token em cada chamada.)
 */
async function protegerPagina(perfilEsperado) {
    const usuario = await usuarioFirebase();
    if (!usuario) { location.replace(`${LOGIN}?perfil=${perfilEsperado}`); return new Promise(() => {}); }

    const eu = await meuPerfil();
    if (eu.incompleto || eu.vincular) { location.replace(CADASTRO_CONCLUIR); return new Promise(() => {}); }
    if (eu.perfil !== perfilEsperado) { location.replace(HOME[eu.perfil]); return new Promise(() => {}); }

    // As páginas leem o usuário logado em Comum.USUARIOS[perfil]
    Comum.USUARIOS[perfilEsperado] = { id: perfilEsperado === "profissional" ? eu.profissionalId : eu.id, usuarioId: eu.id, nome: eu.nome };
    return Comum.USUARIOS[perfilEsperado];
}

/* ---------- Mensagens de erro do Firebase em português ---------- */

const MENSAGENS = {
    "auth/invalid-credential": "E-mail ou senha incorretos. Confira os dados e tente novamente.",
    "auth/wrong-password": "E-mail ou senha incorretos. Confira os dados e tente novamente.",
    "auth/user-not-found": "E-mail ou senha incorretos. Confira os dados e tente novamente.",
    "auth/invalid-email": "Informe um e-mail válido.",
    "auth/email-already-in-use": "Já existe um login com este e-mail. Use “Entrar” com a sua senha, ou “Esqueci minha senha”.",
    "auth/weak-password": "A senha é muito fraca. Use pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    "auth/network-request-failed": "Sem conexão. Verifique a internet e tente de novo.",
    "auth/popup-closed-by-user": "A janela do Google foi fechada antes de terminar.",
    "auth/cancelled-popup-request": "A janela do Google foi fechada antes de terminar.",
    "auth/popup-blocked": "O navegador bloqueou a janela do Google. Libere os pop-ups para este site.",
    "auth/operation-not-allowed": "Este método de login ainda não foi ativado no Firebase (console > Authentication > Sign-in method).",
    "auth/unauthorized-domain": "Este endereço não está autorizado no Firebase (console > Authentication > Settings > Domínios autorizados).",
    "auth/account-exists-with-different-credential": "Já existe uma conta com este e-mail usando outro método de login."
};
function traduzirErro(erro) {
    return MENSAGENS[erro && erro.code] || (erro && erro.codigoApi ? erro.message : null) || (erro && erro.message) || "Algo deu errado. Tente novamente.";
}

/*
 * Aviso no topo da página dizendo em que modo o sistema está. Sem isto, no modo de demonstração
 * parece que o cadastro funcionou de verdade (aceita e-mail repetido, nada aparece no Firebase).
 */
function mostrarAvisoDoModo() {
    const aviso = document.createElement("div");
    aviso.className = `modo-aviso modo-${modo}`;
    aviso.setAttribute("role", "note");
    if (modo === "firebase") {
        aviso.innerHTML = '<strong>Login real (Firebase)</strong> <a href="?auth=mock&api=mock">voltar ao modo demonstração</a>';
    } else {
        aviso.innerHTML = '<strong>Modo demonstração:</strong> login e cadastro são simulados e nada é salvo no Firebase. '
            + '<a href="?auth=firebase&api=http">Usar o login real</a> (precisa da API ligada).';
    }
    document.body.prepend(aviso);
}
if (document.body) mostrarAvisoDoModo(); else document.addEventListener("DOMContentLoaded", mostrarAvisoDoModo);

const AuthService = {
    modo, HOME, LOGIN, CADASTRO_CONCLUIR,
    obterToken, usuarioFirebase, meuPerfil, entrar, entrarComGoogle, cadastrar, concluirCadastro, nomeSugerido,
    enviarConfirmacaoDeEmail, conferirConfirmacaoDeEmail, sair, recuperarSenha, protegerPagina, traduzirErro
};
window.AuthService = AuthService;
if (window.__resolverAuth) window.__resolverAuth(AuthService);       // avisa as páginas que o authService carregou
