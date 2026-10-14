/*
 * Agendamento do cliente, em 5 etapas: serviço, profissional/local, data, horário e confirmação.
 * Os dados vêm só do apiService (hoje mock). A localização é escolhida no seletor "Estou em";
 * na versão final, ela virá da geolocalização (ou de um CEP) e será enviada à API.
 * A regra definitiva contra conflito de horário será do back-end: aqui o apiService já recusa (409).
 * Aceita ?servico=ID na URL para começar já com o serviço escolhido (usado pela página inicial).
 */
(function () {
    const { esc, moeda, iso, deIso, km } = Comum;

    const NOMES_ETAPAS = ["Serviço", "Profissional", "Data", "Horário", "Confirmação"];
    const DIAS_VISIVEIS = 14;
    const ROTULO_ESTADO = { ocupado: "ocupado", indisponivel: "indisponível" };

    const elEtapas = document.getElementById("etapas");
    const elConteudo = document.getElementById("conteudoEtapa");
    const elVoltar = document.getElementById("btnVoltar");
    const elAvancar = document.getElementById("btnAvancar");
    const elBotoes = document.getElementById("botoesEtapa");

    const estado = {
        etapa: 1, grupo: null, profId: null, data: null, hora: null,
        origem: null, servicos: [], origens: [], profissionais: [],
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
            return locais.length ? km(Math.min(...locais.map((p) => p.distanciaKm))) : "sem locais";
        };
        return `<h2 tabindex="-1" id="tituloEtapa">Qual serviço você quer agendar?</h2>
            <fieldset class="ps-lista-radio"><legend class="visually-hidden">Serviços disponíveis</legend>
            ${grupos.map((s) => `<div class="ps-opcao">
                <input type="radio" class="btn-check" name="servico" id="svc-${s.id}" value="${esc(chaveGrupo(s))}" ${chaveGrupo(s) === estado.grupo ? "checked" : ""}>
                <label class="ps-opcao-label" for="svc-${s.id}">
                    <span><strong>${esc(s.nome)}</strong><small>${esc(s.categoria)} · ${s.duracaoMin} min · ${esc(s.descricao)}</small></span>
                    <span class="ps-opcao-lado"><strong>${moeda(s.preco)}</strong><small>a partir de ${menorDistancia(s)}</small></span>
                </label></div>`).join("")}</fieldset>`;
    }

    function etapa2() {
        const locais = profsDoServico();
        return `<h2 tabindex="-1" id="tituloEtapa">Onde você quer ser atendido?</h2>
            <div class="ps-local">
                <label for="origem">Estou em</label>
                <select id="origem" class="form-select form-select-sm">
                    ${estado.origens.map((o) => `<option value="${o.id}" ${o.id === estado.origem ? "selected" : ""}>${esc(o.nome)}</option>`).join("")}
                </select>
                <small>Localização de exemplo. Em breve, usaremos a sua localização real.</small>
            </div>
            <fieldset class="ps-lista-radio"><legend class="visually-hidden">Locais que oferecem ${esc(servico().nome)}</legend>
            ${locais.map((p, i) => `<div class="ps-opcao">
                <input type="radio" class="btn-check" name="prof" id="prof-${p.id}" value="${p.id}" ${p.id === estado.profId ? "checked" : ""}>
                <label class="ps-opcao-label" for="prof-${p.id}">
                    <span class="ps-a-km"><strong>${p.distanciaKm.toFixed(1).replace(".", ",")}</strong><small>km</small></span>
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
        estado.profissionais = await apiService.listarProfissionais({ origem: estado.origem });
        if (!profsDoServico().find((p) => p.id === estado.profId)) estado.profId = null;
    }

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
        } else if (e.target.id === "origem") {
            estado.origem = e.target.value;
            await carregarProfissionais();
            desenhar(false);
            document.getElementById("origem").focus();
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
        const [origens, servicos] = await Promise.all([apiService.listarOrigens(), apiService.listarServicos()]);
        estado.origens = origens;
        estado.servicos = servicos;
        estado.origem = origens.length ? origens[0].id : null;
        await carregarProfissionais();

        // Começa já na etapa 2 quando a página inicial manda ?servico=ID
        const inicial = Number(new URLSearchParams(location.search).get("servico"));
        const inicialServico = servicos.find((s) => s.id === inicial);
        if (inicialServico) { estado.grupo = chaveGrupo(inicialServico); estado.etapa = 2; }
        desenhar(false);
    }
    Comum.sessao("cliente").then(iniciar);
})();
