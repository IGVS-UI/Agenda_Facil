/*
 * Agendamento do cliente, em 5 etapas: serviço, profissional/local, data, horário e confirmação.
 * Antes de tudo, a pessoa diz onde está: localização do navegador (GPS, com permissão), CEP (busca na API)
 * ou um local de exemplo. Só aparecem os serviços de profissionais até RAIO_KM de distância.
 * A distância é calculada pela API (ou pelo apiService no modo simulado); a tela só a exibe.
 * A regra definitiva contra conflito de horário será do back-end: aqui o apiService já recusa (409).
 * Aceita ?servico=ID na URL para começar já com o serviço escolhido (usado pela página inicial).
 */
(function () {
    const { esc, moeda, iso, deIso, km } = Comum;

    const NOMES_ETAPAS = ["Serviço", "Profissional", "Data", "Horário", "Confirmação"];
    const DIAS_VISIVEIS = 14;
    const RAIO_KM = 30;
    const CHAVE_POSICAO = "agendaFacil:posicao";
    const EXEMPLO = { latitude: -23.5649, longitude: -46.6519, descricao: "Av. Paulista, 1000 - São Paulo (local de exemplo)" };
    const ROTULO_ESTADO = { ocupado: "ocupado", indisponivel: "indisponível" };

    const elEtapas = document.getElementById("etapas");
    const elConteudo = document.getElementById("conteudoEtapa");
    const elVoltar = document.getElementById("btnVoltar");
    const elAvancar = document.getElementById("btnAvancar");
    const elBotoes = document.getElementById("botoesEtapa");
    const elLocalizacao = document.getElementById("localizacao");
    const elFluxo = document.getElementById("fluxoAgendamento");

    const estado = {
        etapa: 1, grupo: null, profId: null, data: null, hora: null,
        posicao: null, servicosTodos: [], servicos: [], profissionais: [],   // servicos: só os oferecidos perto do cliente
        localizando: false, erroLocal: "", grupoInicial: null,
        dias: [],          // [{ id, d, horarios, livres }] do profissional escolhido
        agendamento: null, erro: ""
    };

    // No banco cada serviço pertence a UM profissional, então o mesmo serviço (ex.: "Limpeza de pele")
    // pode existir várias vezes. Para o cliente, eles formam um grupo, escolhido pelo nome.
    const chaveGrupo = (s) => s.nome.trim().toLowerCase();
    const idsDoGrupo = () => estado.servicos.filter((s) => chaveGrupo(s) === estado.grupo).map((s) => s.id);
    // O serviço "de verdade": o do profissional escolhido (ou o primeiro do grupo, antes de escolher)
    const servico = () => {
        const ids = idsDoGrupo();
        const doProfissional = estado.profId && prof() ? ids.find((id) => prof().servicosIds.includes(id)) : null;
        return estado.servicos.find((s) => s.id === (doProfissional || ids[0]));
    };
    const prof = () => estado.profissionais.find((p) => p.id === estado.profId);
    // A avaliação ainda não existe no banco (funcionalidade futura): sem nota, não mostra nada
    const nota = (n) => (n == null ? "" : `<span class="ps-nota" aria-label="Nota ${n}">★ ${n.toFixed(1).replace(".", ",")}</span>`);
    const profsDoServico = () => { const ids = idsDoGrupo(); return estado.profissionais.filter((p) => p.servicosIds.some((id) => ids.includes(id))); };

    /* ---------- Cabeçalho das etapas ---------- */

    function desenharEtapas() {
        elEtapas.innerHTML = NOMES_ETAPAS.map((nome, i) => {
            const n = i + 1;
            const cls = estado.agendamento || n < estado.etapa ? "feita" : n === estado.etapa ? "atual" : "";
            return `<li class="${cls}" ${n === estado.etapa && !estado.agendamento ? 'aria-current="step"' : ""}>
                <span class="etapa-numero" aria-hidden="true">${cls === "feita" ? "✓" : n}</span><span class="etapa-nome">${nome}</span></li>`;
        }).join("");
    }

    /* ---------- Conteúdo de cada etapa ---------- */

    function etapa1() {
        const grupos = [];
        estado.servicos.forEach((s) => { if (!grupos.some((g) => chaveGrupo(g) === chaveGrupo(s))) grupos.push(s); });
        const menorDistancia = (s) => {
            const mesmos = estado.servicos.filter((x) => chaveGrupo(x) === chaveGrupo(s)).map((x) => x.id);
            const locais = estado.profissionais.filter((p) => p.servicosIds.some((id) => mesmos.includes(id)));
            const distancias = locais.map((p) => p.distanciaKm).filter((d) => d != null);
            return distancias.length ? `a partir de ${km(Math.min(...distancias))}` : "";
        };
        if (!grupos.length) {
            return `<h2 tabindex="-1" id="tituloEtapa">Qual serviço você quer agendar?</h2>
                <p class="ps-vazio">Nenhum serviço disponível perto de você (até ${RAIO_KM} km). Troque a localização acima para ver outra região.</p>`;
        }
        return `<h2 tabindex="-1" id="tituloEtapa">Qual serviço você quer agendar?</h2>
            <fieldset class="ps-lista-radio"><legend class="visually-hidden">Serviços disponíveis</legend>
            ${grupos.map((s) => `<div class="ps-opcao">
                <input type="radio" class="btn-check" name="servico" id="svc-${s.id}" value="${esc(chaveGrupo(s))}" ${chaveGrupo(s) === estado.grupo ? "checked" : ""}>
                <label class="ps-opcao-label" for="svc-${s.id}">
                    <span><strong>${esc(s.nome)}</strong><small>${esc(s.categoria)} · ${s.duracaoMin} min · ${esc(s.descricao)}</small></span>
                    <span class="ps-opcao-lado"><strong>${moeda(s.preco)}</strong><small>${menorDistancia(s)}</small></span>
                </label></div>`).join("")}</fieldset>`;
    }

    function etapa2() {
        const locais = profsDoServico();
        return `<h2 tabindex="-1" id="tituloEtapa">Onde você quer ser atendido?</h2>
            <fieldset class="ps-lista-radio"><legend class="visually-hidden">Locais que oferecem ${esc(servico().nome)}</legend>
            ${locais.map((p, i) => `<div class="ps-opcao">
                <input type="radio" class="btn-check" name="prof" id="prof-${p.id}" value="${p.id}" ${p.id === estado.profId ? "checked" : ""}>
                <label class="ps-opcao-label" for="prof-${p.id}">
                    <span class="ps-a-km"><strong>${p.distanciaKm != null ? p.distanciaKm.toFixed(1).replace(".", ",") : "–"}</strong><small>km</small></span>
                    <span><strong>${esc(p.local)}</strong><small>${esc(p.nome)} · ${esc(p.endereco)}</small></span>
                    <span class="ps-opcao-lado">${nota(p.avaliacao)}${i === 0 ? '<small class="ps-proximo">mais próximo</small>' : ""}</span>
                </label></div>`).join("") || '<p class="ps-vazio">Nenhum local oferece este serviço perto de você.</p>'}</fieldset>`;
    }

    function etapa3() {
        return `<h2 tabindex="-1" id="tituloEtapa">Em que dia?</h2>
            <p class="ps-sub">${esc(servico().nome)} com ${esc(prof().nome)}. Dias passados não aparecem, e dias sem horário livre ficam bloqueados.</p>
            <div class="ps-dias" role="group" aria-label="Escolha o dia">
            ${estado.dias.map((x) => `<button type="button" class="ps-dia" data-dia="${x.id}" aria-pressed="${x.id === estado.data}" ${x.livres ? "" : "disabled"}
                title="${x.livres ? `${x.livres} horário(s) livre(s)` : "Sem horários"}">
                <small>${x.d.toLocaleDateString("pt-BR", { weekday: "short" })}</small><strong>${x.d.getDate()}</strong>
                <small>${x.d.toLocaleDateString("pt-BR", { month: "short" })}</small></button>`).join("")}</div>`;
    }

    function etapa4() {
        const dia = estado.dias.find((x) => x.id === estado.data);
        return `<h2 tabindex="-1" id="tituloEtapa">Qual horário?</h2>
            <p class="ps-sub">${esc(deIso(estado.data).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }))}</p>
            <div class="ps-slots" role="group" aria-label="Escolha o horário">
            ${dia.horarios.map((h) => `<button type="button" class="ps-slot ps-slot-${h.estado}" data-hora="${h.hora}"
                aria-pressed="${h.hora === estado.hora}" ${h.estado === "disponivel" ? "" : "disabled"}>${h.hora}
                ${h.estado !== "disponivel" ? `<small>${ROTULO_ESTADO[h.estado]}</small>` : ""}</button>`).join("")}</div>
            <p class="ps-legenda">Horários ocupados ou indisponíveis não podem ser escolhidos.</p>`;
    }

    function resumo() {
        return `<dl class="ps-resumo-dl">
            <dt>Serviço</dt><dd>${esc(servico().nome)} · ${servico().duracaoMin} min · ${moeda(servico().preco)}</dd>
            <dt>Profissional</dt><dd>${esc(prof().nome)}</dd>
            <dt>Local</dt><dd>${esc(prof().local)} · ${esc(prof().endereco)}</dd>
            <dt>Data</dt><dd>${esc(deIso(estado.data).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }))}</dd>
            <dt>Horário</dt><dd>${estado.hora}</dd></dl>`;
    }

    function etapa5() {
        if (estado.agendamento) {
            return `<div class="ps-ok" role="status">
                <h2 tabindex="-1" id="tituloEtapa">Agendamento realizado!</h2>
                <p>Seu horário foi reservado e está <strong>pendente</strong> até o profissional confirmar.</p>
                ${resumo()}
                <div class="pp-acoes">
                    <a class="btn btn-primary" href="meus_agendamentos_usuario.html">Ver meus agendamentos</a>
                    <button type="button" class="btn btn-outline-primary" id="novoAgendamento">Agendar outro serviço</button>
                </div></div>`;
        }
        return `<h2 tabindex="-1" id="tituloEtapa">Confira e confirme</h2>
            ${resumo()}
            ${estado.erro ? `<div class="alert alert-danger" role="alert">${esc(estado.erro)}</div>` : ""}`;
    }

    const ETAPAS = [null, etapa1, etapa2, etapa3, etapa4, etapa5];

    /* ---------- Controle ---------- */

    // Cada etapa exige uma escolha antes de continuar (a confirmação não exige nada)
    function podeAvancar() {
        return Boolean([null, estado.grupo, estado.profId, estado.data, estado.hora, true][estado.etapa]);
    }

    function desenhar(focar = true) {
        desenharEtapas();
        elConteudo.innerHTML = ETAPAS[estado.etapa]();
        elBotoes.hidden = Boolean(estado.agendamento);
        elVoltar.disabled = estado.etapa === 1;
        elAvancar.textContent = estado.etapa === 5 ? "Confirmar agendamento" : "Continuar";
        elAvancar.disabled = !podeAvancar();
        if (focar) { const t = document.getElementById("tituloEtapa"); if (t) t.focus({ preventScroll: false }); }
    }

    // Carrega os dias e horários do profissional escolhido (etapas 3 e 4)
    async function carregarDias() {
        const dias = [];
        for (let i = 0; i < DIAS_VISIVEIS; i++) { const d = new Date(); d.setDate(d.getDate() + i); dias.push(d); }
        const listas = await Promise.all(dias.map((d) => apiService.listarHorariosDisponiveis({ profissionalId: estado.profId, data: iso(d), servicoId: servico().id })));
        estado.dias = dias.map((d, i) => ({ d, id: iso(d), horarios: listas[i], livres: listas[i].filter((h) => h.estado === "disponivel").length }));
    }

    async function carregarProfissionais() {
        const { latitude, longitude } = estado.posicao;
        estado.profissionais = await apiService.listarProfissionais({ latitude, longitude, raioKm: RAIO_KM });
        const perto = new Set(estado.profissionais.flatMap((p) => p.servicosIds));
        estado.servicos = estado.servicosTodos.filter((s) => perto.has(s.id));
        if (estado.grupo && !estado.servicos.some((s) => chaveGrupo(s) === estado.grupo)) { estado.grupo = null; estado.etapa = 1; }
        if (!profsDoServico().find((p) => p.id === estado.profId)) estado.profId = null;
    }

    /* ---------- "Onde você está?" ---------- */

    function desenharLocalizacao() {
        elFluxo.hidden = !estado.posicao;
        if (estado.posicao) {
            elLocalizacao.innerHTML = `<p class="ps-loc-atual" id="tituloLocalizacao">
                <span aria-hidden="true">📍</span> Mostrando profissionais até ${RAIO_KM} km de <strong>${esc(estado.posicao.descricao)}</strong>
                <button type="button" class="btn btn-link btn-sm" data-trocar-local>Trocar localização</button></p>`;
            return;
        }
        const comApi = typeof API_MODO !== "undefined" && API_MODO === "http";
        elLocalizacao.innerHTML = `<div class="ps-loc-cartao">
            <h2 id="tituloLocalizacao">Onde você está?</h2>
            <p class="ps-sub">Mostramos só os profissionais perto de você (até ${RAIO_KM} km).</p>
            <div class="ps-loc-opcoes">
                <button type="button" class="btn btn-primary" data-gps ${estado.localizando ? "disabled" : ""}>
                    ${estado.localizando ? "Localizando…" : "Usar minha localização"}</button>
                <form class="ps-loc-cep" data-form-cep novalidate>
                    <label class="visually-hidden" for="cepCliente">CEP</label>
                    <input class="form-control" id="cepCliente" inputmode="numeric" maxlength="9" placeholder="Ou digite o CEP" autocomplete="postal-code" ${comApi ? "" : "disabled"}>
                    <button type="submit" class="btn btn-outline-primary" ${comApi ? "" : "disabled"}>Buscar</button>
                </form>
            </div>
            ${comApi ? "" : '<p class="ps-legenda">A busca por CEP funciona com a API ligada (?api=http).</p>'}
            <button type="button" class="btn btn-link btn-sm px-0" data-exemplo>Usar um local de exemplo (Av. Paulista, 1000 - São Paulo)</button>
            ${estado.erroLocal ? `<div class="alert alert-warning mt-2 mb-0" role="alert">${esc(estado.erroLocal)}</div>` : ""}
        </div>`;
    }

    async function definirPosicao(posicao) {
        estado.posicao = posicao;
        estado.erroLocal = "";
        try { sessionStorage.setItem(CHAVE_POSICAO, JSON.stringify(posicao)); } catch (erro) { /* só não lembra */ }
        await carregarProfissionais();
        // a página inicial pode ter mandado ?servico=ID: só vale se esse serviço existir perto
        if (estado.grupoInicial && estado.servicos.some((s) => chaveGrupo(s) === estado.grupoInicial)) {
            estado.grupo = estado.grupoInicial; estado.etapa = 2;
        }
        estado.grupoInicial = null;
        desenharLocalizacao();
        desenhar();
    }

    function usarGps() {
        if (!navigator.geolocation) { estado.erroLocal = "Este navegador não informa a localização. Digite o CEP."; return desenharLocalizacao(); }
        estado.localizando = true; estado.erroLocal = "";
        desenharLocalizacao();
        navigator.geolocation.getCurrentPosition(
            (p) => { estado.localizando = false; definirPosicao({ latitude: p.coords.latitude, longitude: p.coords.longitude, descricao: "sua localização atual" }); },
            (erro) => {
                estado.localizando = false;
                estado.erroLocal = erro.code === 1
                    ? "Você não permitiu o acesso à localização. Digite o CEP ou use o local de exemplo."
                    : "Não foi possível descobrir a sua localização agora. Digite o CEP ou use o local de exemplo.";
                desenharLocalizacao();
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
    }

    async function usarCep(cep) {
        if (cep.replace(/\D/g, "").length !== 8) { estado.erroLocal = "Informe um CEP com 8 números."; return desenharLocalizacao(); }
        estado.localizando = true; estado.erroLocal = "";
        desenharLocalizacao();
        try {
            const local = await apiService.buscarLocalizacaoPorCep(cep);
            estado.localizando = false;
            await definirPosicao({ latitude: local.latitude, longitude: local.longitude, descricao: local.descricao });
        } catch (erro) {
            estado.localizando = false;
            estado.erroLocal = erro.message;
            desenharLocalizacao();
        }
    }

    elLocalizacao.addEventListener("click", (e) => {
        if (e.target.closest("[data-gps]")) usarGps();
        else if (e.target.closest("[data-exemplo]")) definirPosicao(EXEMPLO);
        else if (e.target.closest("[data-trocar-local]")) {
            estado.posicao = null;
            try { sessionStorage.removeItem(CHAVE_POSICAO); } catch (erro) { /* nada */ }
            desenharLocalizacao();
        }
    });
    elLocalizacao.addEventListener("submit", (e) => {
        e.preventDefault();
        usarCep(document.getElementById("cepCliente").value);
    });
    elLocalizacao.addEventListener("input", (e) => {
        if (e.target.id !== "cepCliente") return;
        const n = e.target.value.replace(/\D/g, "").slice(0, 8);
        e.target.value = n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
    });

    async function avancar() {
        if (!podeAvancar()) return;
        if (estado.etapa === 2) { await carregarDias(); if (!estado.dias.find((x) => x.id === estado.data && x.livres)) { estado.data = null; estado.hora = null; } }
        if (estado.etapa === 5) { await confirmar(); return; }
        estado.etapa += 1;
        estado.erro = "";
        desenhar();
    }

    async function confirmar() {
        elAvancar.disabled = true;
        elAvancar.textContent = "Confirmando…";
        try {
            estado.agendamento = await apiService.criarAgendamento({
                clienteId: Comum.USUARIOS.cliente.id, servicoId: servico().id,
                profissionalId: estado.profId, data: estado.data, hora: estado.hora
            });
            desenhar();
        } catch (erro) {
            // Normalmente: alguém reservou o horário antes (409). Volta para escolher outro.
            estado.erro = erro.message;
            estado.hora = null;
            await carregarDias();
            estado.etapa = 4;
            desenhar();
            elConteudo.insertAdjacentHTML("beforeend", `<div class="alert alert-danger mt-3" role="alert">${esc(erro.message)} Escolha outro horário.</div>`);
        }
    }

    function reiniciar() {
        Object.assign(estado, { etapa: 1, grupo: null, profId: null, data: null, hora: null, dias: [], agendamento: null, erro: "" });
        desenhar();
    }

    elAvancar.addEventListener("click", avancar);
    elVoltar.addEventListener("click", () => { if (estado.etapa > 1) { estado.etapa -= 1; estado.erro = ""; desenhar(); } });

    elConteudo.addEventListener("change", async (e) => {
        if (e.target.name === "servico") {
            estado.grupo = e.target.value;
            if (!profsDoServico().find((p) => p.id === estado.profId)) estado.profId = null;
            estado.data = null; estado.hora = null;
            elAvancar.disabled = !podeAvancar();
        } else if (e.target.name === "prof") {
            estado.profId = Number(e.target.value);
            estado.data = null; estado.hora = null;
            elAvancar.disabled = !podeAvancar();
        }
    });

    elConteudo.addEventListener("click", (e) => {
        const dia = e.target.closest("[data-dia]");
        if (dia) { estado.data = dia.dataset.dia; estado.hora = null; desenhar(false); document.querySelector(`[data-dia="${estado.data}"]`).focus(); elAvancar.disabled = !podeAvancar(); return; }
        const hora = e.target.closest("[data-hora]");
        if (hora) { estado.hora = hora.dataset.hora; desenhar(false); document.querySelector(`[data-hora="${estado.hora}"]`).focus(); return; }
        if (e.target.closest("#novoAgendamento")) reiniciar();
    });

    async function iniciar() {
        Comum.montarUsuario(document.getElementById("nav-usuario"), "cliente");
        estado.servicosTodos = await apiService.listarServicos();

        // A página inicial pode mandar ?servico=ID: guardado até a localização ser definida
        const inicial = Number(new URLSearchParams(location.search).get("servico"));
        const inicialServico = estado.servicosTodos.find((s) => s.id === inicial);
        if (inicialServico) estado.grupoInicial = chaveGrupo(inicialServico);

        let lembrada = null;
        try { lembrada = JSON.parse(sessionStorage.getItem(CHAVE_POSICAO)); } catch (erro) { /* nada */ }
        if (lembrada && Number.isFinite(lembrada.latitude) && Number.isFinite(lembrada.longitude)) await definirPosicao(lembrada);
        else desenharLocalizacao();
    }
    Comum.sessao("cliente").then(iniciar);
})();
