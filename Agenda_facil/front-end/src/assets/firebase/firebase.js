// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"; // <-- Adicionado para Autenticação

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBjH1b9q0cklJKRUlbArnBq7B-ImFV3sOo",
  authDomain: "projeto-ragozzinni.firebaseapp.com",
  projectId: "projeto-ragozzinni",
  storageBucket: "projeto-ragozzinni.firebasestorage.app",
  messagingSenderId: "264035447874",
  appId: "1:264035447874:web:a4f78f9be352b62ae6e9db",
  measurementId: "G-565YX60M1G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase Authentication and export it
export const auth = getAuth(app); // <-- Inicializado e exportado para uso no app
