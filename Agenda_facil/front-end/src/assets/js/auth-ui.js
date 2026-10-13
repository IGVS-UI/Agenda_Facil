/*
 * Comportamento dos formulários de login e cadastro (validação, mostrar senha, carregamento).
 * Tudo é simulado: o Firebase Authentication entra na etapa de integração.
 * No login, erro@teste.com simula "e-mail ou senha incorretos".
 */
(function () {
    const form = document.querySelector("form[data-acao]");
    const params = new URLSearchParams(location.search);

    // Para onde cada perfil vai depois de entrar (simulado)
    const DESTINOS = {
        cliente: { href: "../servicos_usuario.html", texto: "Ver serviços perto de você" },
        profissional: { href: "../agendamentos_profissional.html", texto: "Ir para a agenda do dia" }
    };

    /* ---------- Validação ---------- */

    const REGRAS = {
        obrigatorio: (el) => el.value.trim() ? "" : "Preencha este campo.",
        email: (el) => !el.value.trim() ? "Informe seu e-mail."
            : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim()) ? "" : "Informe um e-mail válido, como nome@email.com.",
        senha: (el) => !el.value ? "Informe sua senha." : el.value.length >= 6 ? "" : "A senha deve ter pelo menos 6 caracteres.",
        confirma: (el) => !el.value ? "Confirme sua senha." : el.value === form.querySelector("#senha").value ? "" : "As senhas não são iguais.",
        cep: (el) => !el.value.trim() ? "Informe o CEP."
            : el.value.replace(/\D/g, "").length === 8 ? "" : "O CEP deve ter 8 números, como 01310-100.",
        uf: (el) => el.value ? "" : "Escolha o estado.",
        termos: (el) => el.checked ? "" : "Aceite os termos para continuar."
    };

    function validarCampo(el) {
        if (el.offsetParent === null) return true; // campo escondido (dados de profissional para quem é cliente)
        const msg = REGRAS[el.dataset.regra](el);
        document.getElementById(`${el.id}-erro`).textContent = msg;
        el.classList.toggle("is-invalid", Boolean(msg));
        if (msg) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
        return !msg;
    }

    function validarFormulario() {
        const invalidos = [...form.querySelectorAll("[data-regra]")].filter((el) => !validarCampo(el));
        if (invalidos.length) invalidos[0].focus();
        return invalidos.length === 0;
    }

    /* ---------- Envio simulado ---------- */

    const status = form.querySelector(".pa-status");
    function mostrarStatus(html, tipo) {
        status.className = `pa-status${tipo ? ` pa-status-${tipo}` : ""}`;
        status.innerHTML = html;
    }

    function perfilEscolhido() {
        const marcado = form.querySelector("input[name='perfil']:checked, input[name='tipo']:checked");
        return marcado ? marcado.value : "cliente";
    }

    function concluirLogin(prefixo) {
        const destino = DESTINOS[perfilEscolhido()];
        mostrarStatus(`${prefixo} <a href="${destino.href}">${destino.texto}</a>`, "ok");
        setTimeout(() => { location.href = destino.href; }, 900);
    }

    function enviar() {
        if (!validarFormulario()) return;
        const botao = form.querySelector(".pa-enviar");
        const spinner = botao.querySelector(".spinner-border");
        botao.disabled = true;
        spinner.classList.remove("d-none");
        mostrarStatus("", "");
        const email = form.querySelector("#email").value.trim().toLowerCase();

        setTimeout(() => {
            botao.disabled = false;
            spinner.classList.add("d-none");
            if (form.dataset.acao === "login") {
                if (email === "erro@teste.com") mostrarStatus("E-mail ou senha incorretos. Confira os dados e tente novamente.", "erro");
                else concluirLogin("Login realizado.");
            } else if (form.dataset.acao === "recuperar") {
                mostrarStatus('Se este e-mail estiver cadastrado, enviamos as instruções para criar uma nova senha. <a href="login.html">Voltar ao login</a>', "ok");
            } else {
                mostrarStatus('Conta criada com sucesso. <a href="login.html">Ir para o login</a>', "ok");
            }
        }, 1200);
    }

    /* ---------- Eventos ---------- */

    form.addEventListener("submit", (e) => { e.preventDefault(); enviar(); });

    form.addEventListener("focusout", (e) => {
        if (e.target.matches("[data-regra]") && (e.target.value || e.target.classList.contains("is-invalid"))) validarCampo(e.target);
    });

    form.addEventListener("input", (e) => {
        if (e.target.id === "cep") {
            const n = e.target.value.replace(/\D/g, "").slice(0, 8);
            e.target.value = n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
        }
        if (e.target.classList.contains("is-invalid")) validarCampo(e.target);
    });

    form.addEventListener("change", (e) => {
        if (e.target.name === "tipo") form.dataset.tipo = e.target.value; // mostra/esconde os dados de profissional
    });

    form.addEventListener("click", (e) => {
        const olho = e.target.closest(".pa-olho");
        if (olho) {
            const entrada = document.getElementById(olho.dataset.alvo);
            const mostrar = entrada.type === "password";
            entrada.type = mostrar ? "text" : "password";
            olho.textContent = mostrar ? "Ocultar" : "Mostrar";
            olho.setAttribute("aria-pressed", String(mostrar));
            olho.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
            return;
        }
        const google = e.target.closest("[data-google]");
        if (google) {
            const texto = google.querySelector(".pa-google-texto");
            google.disabled = true;
            texto.textContent = "Conectando ao Google…";
            mostrarStatus("", "");
            setTimeout(() => {
                google.disabled = false;
                texto.textContent = "Continuar com o Google";
                concluirLogin("Login com Google realizado.");
            }, 1200);
        }
    });

    /* ---------- Perfil inicial vindo da URL (?perfil= no login, ?tipo= no cadastro) ---------- */

    const inicial = params.get("perfil") || params.get("tipo");
    if (inicial === "profissional") {
        const radio = form.querySelector("input[type='radio'][value='profissional']");
        if (radio) { radio.checked = true; form.dataset.tipo = "profissional"; }
    }
})();
