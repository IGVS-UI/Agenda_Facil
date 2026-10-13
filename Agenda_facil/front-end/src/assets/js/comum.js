/*
 * Utilidades compartilhadas pelas páginas internas (cliente e profissional).
 *
 * USUARIOS: usuários fixos de demonstração. Enquanto o login real (Firebase) não existe,
 * cada página usa o usuário do seu perfil. Na integração, isto é trocado pelo usuário logado.
 */
const Comum = (function () {
    const USUARIOS = {
        cliente: { id: 1, nome: "Igor Silva" },
        profissional: { id: 1, nome: "João Barbosa" }
    };

    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const moeda = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const deIso = (texto) => new Date(`${texto}T00:00:00`);
    const km = (n) => `${n.toFixed(1).replace(".", ",")} km`;

    // "Olá, Igor" + botão Sair na navbar
    function montarUsuario(alvo, perfil) {
        alvo.innerHTML = `<span class="pc-ola">Olá, <strong>${esc(USUARIOS[perfil].nome.split(" ")[0])}</strong></span>
            <a class="btn btn-outline-primary btn-sm" href="autentificação/login.html?perfil=${perfil}">Sair</a>`;
    }

    return { USUARIOS, esc, moeda, iso, deIso, km, montarUsuario };
})();
