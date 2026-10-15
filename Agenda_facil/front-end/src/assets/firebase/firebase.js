/*
 * Inicialização do Firebase Authentication (login e cadastro).
 *
 * Os módulos vêm direto da CDN do Firebase (sem npm nem empacotador), então este arquivo funciona
 * no navegador como "import" de módulo ES. Quem usa é o js/authService.js; as páginas não importam
 * este arquivo diretamente.
 *
 * A configuração abaixo (apiKey etc.) é a "configuração web" do projeto: ela identifica o projeto
 * e NÃO é segredo (a segurança está nas regras do Firebase e na verificação do token na API).
 * A chave PRIVADA (conta de serviço) é outra coisa: fica só no back-end, nunca aqui.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
    getAuth, connectAuthEmulator, onAuthStateChanged, signOut,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
    GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// Configuração do projeto (do console do Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyBjH1b9q0cklJKRUlbArnBq7B-ImFV3sOo",
  authDomain: "projeto-ragozzinni.firebaseapp.com",
  projectId: "projeto-ragozzinni",
  storageBucket: "projeto-ragozzinni.firebasestorage.app",
  messagingSenderId: "264035447874",
  appId: "1:264035447874:web:a4f78f9be352b62ae6e9db",
  measurementId: "G-565YX60M1G"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = "pt-BR";          // e-mails de redefinição de senha em português

// Emulador do Firebase (testes locais, sem tocar nas contas reais): abra qualquer página com ?emulador=1
// (desligue com ?emulador=0). Requer o emulador rodando em 127.0.0.1:9099.
try {
    const pedido = new URLSearchParams(location.search).get("emulador");
    if (pedido === "1" || pedido === "0") sessionStorage.setItem("agendaFacil:emulador", pedido);
    if (sessionStorage.getItem("agendaFacil:emulador") === "1") connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
} catch (erro) { /* sem sessionStorage: segue com o Firebase real */ }

export {
    onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
    GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, sendEmailVerification
};
