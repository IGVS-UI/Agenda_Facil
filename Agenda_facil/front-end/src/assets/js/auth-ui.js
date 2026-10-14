/*
 * Comportamento dos formulários de login, cadastro e recuperação de senha
 * (validação, mostrar senha, carregamento, mensagens de erro).
 *
 * Dois modos (escolhidos pelo authService.js, com ?auth=firebase ou ?auth=mock):
 *   mock     -> tudo simulado (padrão). No login, erro@teste.com simula "e-mail ou senha incorretos".
 *   firebase -> Firebase Authentication de verdade; a API guarda o perfil (cliente/profissional).
 */
(function () {
    const form = document.querySelector("form[data-acao]");
    const params = new URLSearchParams(location.search);

    const firebaseAtivo = () => window.AuthService && AuthService.modo === "firebase";

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
        telefone: (el) => !el.value.trim() ? "Informe o seu telefone."
            : el.value.replace(/\D/g, "").length >= 10 ? "" : "Informe o telefone com DDD, como (11) 91234-5678.",
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

    /* ---------- Firebase de verdade ---------- */

    // Dados que a API pede no cadastro (o e-mail NÃO vai: a API pega do token do Firebase)
    function dadosDoCadastro() {
        const valor = (id) => (form.querySelector(`#${id}`).value || "").trim();
        const perfil = perfilEscolhido();
        const dados = { perfil, nome: valor("nome"), telefone: valor("telefone") };
        if (perfil === "profissional") {
            dados.profissional = {
                especialidade: valor("especialidade"), nomeLocal: valor("local"), cep: valor("cep"),
                logradouro: valor("endereco"), numero: valor("numero"), complemento: valor("complemento"),
                bairro: valor("bairro"), cidade: valor("cidade"), uf: valor("uf")
            };
        }
        return dados;
    }

    // Leva a pessoa para a página do perfil que o BANCO diz que ela tem
    function irParaAreaDo(eu, aviso) {
        if (eu.incompleto) {
            mostrarStatus("Falta concluir o seu cadastro. Levando você para lá…", "ok");
            return setTimeout(() => { location.href = `../${AuthService.CADASTRO_CONCLUIR}`; }, 900);
        }
        const destino = `../${AuthService.HOME[eu.perfil]}`;
        mostrarStatus(`${aviso || "Tudo certo."} <a href="${destino}">Continuar</a>`, "ok");
        setTimeout(() => { location.href = destino; }, 900);
    }

    async function enviarComFirebase() {
        const campo = (id) => { const e = form.querySelector(`#${id}`); return e ? e.value.trim() : ""; };
        if (form.dataset.acao === "login") {
            const escolhido = perfilEscolhido();
            const eu = await AuthService.entrar(campo("email"), form.querySelector("#senha").value);
            const aviso = !eu.incompleto && eu.perfil !== escolhido ? `Esta conta é de ${eu.perfil}, entrando como ${eu.perfil}.` : "Login realizado.";
            return irParaAreaDo(eu, aviso);
        }
        if (form.dataset.acao === "recuperar") {
            await AuthService.recuperarSenha(campo("email"));
            return mostrarStatus('Se este e-mail estiver cadastrado, enviamos as instruções para criar uma nova senha. <a href="login.html">Voltar ao login</a>', "ok");
        }
        // cadastro (novo) ou conclusão de cadastro (quem entrou pelo Google e ainda não tem conta no sistema)
        const eu = form.dataset.concluir === "1"
            ? await AuthService.concluirCadastro(dadosDoCadastro())
            : await AuthService.cadastrar(campo("email"), form.querySelector("#senha").value, dadosDoCadastro());
        irParaAreaDo(eu, "Conta criada com sucesso.");
    }

    function enviar() {
        if (!validarFormulario()) return;
        const botao = form.querySelector(".pa-enviar");
        const spinner = botao.querySelector(".spinner-border");
        botao.disabled = true;
        spinner.classList.remove("d-none");
        mostrarStatus("", "");

        if (firebaseAtivo()) {
            enviarComFirebase()
                .catch((erro) => mostrarStatus(AuthService.traduzirErro(erro), "erro"))
                .finally(() => { botao.disabled = false; spinner.classList.add("d-none"); });
            return;
        }
        const email = form.querySelector("#email").value.trim().toLowerCase();

        setTimeout(() => {
            botao.disabled = false;
            spinner.classList.add("d-none");
            if (form.dataset.acao === "login") {
                if (email === "erro@teste.com") mostrarStatus("E-mail ou senha incorretos. Confira os dados e tente novamente.", "erro");
                else concluirLogin("Login simulado (modo demonstração).");
            } else if (form.dataset.acao === "recuperar") {
                mostrarStatus('Se este e-mail estiver cadastrado, enviamos as instruções para criar uma nova senha. <a href="login.html">Voltar ao login</a>', "ok");
            } else {
                mostrarStatus('Conta criada na <strong>simulação</strong> (nada foi salvo no Firebase). <a href="login.html">Ir para o login</a>', "ok");
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
            if (firebaseAtivo()) {
                AuthService.entrarComGoogle()
                    .then((eu) => irParaAreaDo(eu, "Login com o Google realizado."))
                    .catch((erro) => mostrarStatus(AuthService.traduzirErro(erro), "erro"))
                    .finally(() => { google.disabled = false; texto.textContent = "Continuar com o Google"; });
                return;
            }
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

    /* ---------- cadastro.html?concluir=1: 1º login com Google, falta escolher o perfil e preencher os dados ---------- */

    async function prepararConclusao() {
        const aviso = (texto) => { status.className = "pa-status pa-status-erro"; status.textContent = texto; };
        if (!firebaseAtivo()) return;                       // no mock não existe "cadastro incompleto"
        const usuario = await AuthService.usuarioFirebase();
        if (!usuario) { location.replace("login.html"); return; }

        form.dataset.concluir = "1";
        document.getElementById("titulo").textContent = "Concluir cadastro";
        form.querySelector(".pa-enviar span:last-child").textContent = "Concluir cadastro";
        const intro = document.createElement("p");
        intro.className = "pa-sub";
        intro.textContent = `Você entrou como ${usuario.email}. Falta só escolher o seu perfil e completar os dados.`;
        document.getElementById("titulo").after(intro);
        // e-mail e senha já existem no Firebase
        ["email", "senha", "confirma"].forEach((id) => { form.querySelector(`#${id}`).closest(".pa-campo").hidden = true; });
        const rodape = form.querySelector(".pa-rodape");
        if (rodape) rodape.hidden = true;
        const sugestao = await AuthService.nomeSugerido();
        if (sugestao.nome) form.querySelector("#nome").value = sugestao.nome;
    }
    // A dica "erro@teste.com simula login recusado" só vale no modo demonstração
    window.addEventListener("load", () => {
        const dica = form.querySelector(".pa-dica");
        if (dica && firebaseAtivo()) dica.hidden = true;
    });

    if (params.get("concluir") === "1") {
        // espera o authService (módulo) carregar
        window.addEventListener("load", () => { prepararConclusao().catch((e) => { status.className = "pa-status pa-status-erro"; status.textContent = e.message; }); });
    }
})();
