/*
 * Meus agendamentos (cliente): resumo + calendário do mês, com a lista do dia escolhido ao lado.
 * Mostra só os agendamentos do cliente (apiService.listarAgendamentos com clienteId).
 * Cancelar passa por uma confirmação e usa apiService.alterarStatus.
 */
(function () {
    const { esc, moeda, iso, deIso } = Comum;

    const STATUS = {
        PENDENTE: { rotulo: "Pendente", cls: "pendente" },
        CONFIRMADO: { rotulo: "Confirmado", cls: "confirmado" },
        CONCLUIDO: { rotulo: "Concluído", cls: "concluido" },
        CANCELADO: { rotulo: "Cancelado", cls: "cancelado" }
    };
    const ATIVOS = ["PENDENTE", "CONFIRMADO"];
    const clienteId = Comum.USUARIOS.cliente.id;

    const elProximo = document.getElementById("proximo");
    const elResumo = document.getElementById("resumo");
    const elMesTitulo = document.getElementById("mesTitulo");
    const elCalendario = document.getElementById("calendario");
    const elDiaTitulo = document.getElementById("diaTitulo");
    const elDiaLista = document.getElementById("diaLista");

    let lista = [];                              // agendamentos do cliente
    let mes = new Date(); mes.setDate(1);
    let diaSel = iso(new Date());
    let idCancelar = null;

    const quando = (a) => new Date(`${a.data}T${a.hora}:00`);
    const futuro = (a) => ATIVOS.includes(a.status) && quando(a) >= new Date();
    const badge = (st) => `<span class="pp-status pp-${STATUS[st].cls}">${STATUS[st].rotulo}</span>`;

    function relativo(a) {
        const dias = Math.round((deIso(a.data) - deIso(iso(new Date()))) / 86400000);
        if (dias === 0) return "Hoje";
        if (dias === 1) return "Amanhã";
        return deIso(a.data).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
    }

    /* ---------- Próximo agendamento ---------- */

    function desenharProximo() {
        const prox = lista.filter(futuro)[0];   // a lista já vem em ordem cronológica
        if (!prox) {
            elProximo.innerHTML = `<p class="pm-destaque-etiqueta" id="proximoEtiqueta">Seu próximo agendamento</p>
                <p class="pm-destaque-vazio">Você não tem agendamentos futuros.</p>
                <a class="btn btn-light btn-sm" href="servicos_usuario.html">Agendar um serviço</a>`;
            return;
        }
        elProximo.innerHTML = `<p class="pm-destaque-etiqueta" id="proximoEtiqueta">Seu próximo agendamento</p>
            <p class="pm-destaque-quando">${esc(relativo(prox))}, ${prox.hora}</p>
            <p class="pm-destaque-serv">${esc(prox.servico.nome)} · ${esc(prox.profissional.local)}</p>
            <p>${badge(prox.status)} <button type="button" class="btn btn-link btn-sm pm-destaque-ver" data-ver-dia="${prox.data}">Ver no calendário</button></p>`;
    }

    /* ---------- Resumo ---------- */

    function desenharResumo() {
        const n = (st) => lista.filter((a) => a.status === st).length;
        elResumo.innerHTML = `
            <div class="pp-resumo-confirmado"><dt>Próximos</dt><dd>${lista.filter(futuro).length}</dd></div>
            <div class="pp-resumo-concluido"><dt>Concluídos</dt><dd>${n("CONCLUIDO")}</dd></div>
            <div class="pp-resumo-cancelado"><dt>Cancelados</dt><dd>${n("CANCELADO")}</dd></div>`;
    }

    /* ---------- Calendário ---------- */

    function desenharCalendario() {
        const ano = mes.getFullYear(), m = mes.getMonth();
        const deslocamento = new Date(ano, m, 1).getDay();
        const total = new Date(ano, m + 1, 0).getDate();
        const nomeMes = mes.toLocaleDateString("pt-BR", { month: "long" });
        const celulas = [];
        for (let i = 0; i < deslocamento; i++) celulas.push('<li aria-hidden="true"></li>');
        for (let d = 1; d <= total; d++) {
            const id = iso(new Date(ano, m, d));
            const doDia = lista.filter((a) => a.data === id);
            celulas.push(`<li><button type="button" class="pm-b-dia" data-dia="${id}" aria-pressed="${id === diaSel}"
                aria-label="${d} de ${nomeMes}, ${doDia.length} agendamento(s)">
                <span>${d}</span><span class="pm-b-pontos">${doDia.map((a) => `<i class="pm-ponto pm-${STATUS[a.status].cls}"></i>`).join("")}</span></button></li>`);
        }
        elMesTitulo.textContent = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        elCalendario.innerHTML = celulas.join("");
    }

    /* ---------- Lista do dia ---------- */

    function detalhes(a) {
        return `<dl class="pm-det">
            <dt>Serviço</dt><dd>${esc(a.servico.nome)} · ${a.servico.duracaoMin} min · ${moeda(a.servico.preco)}</dd>
            <dt>Profissional</dt><dd>${esc(a.profissional.nome)}</dd>
            <dt>Local</dt><dd>${esc(a.profissional.local)} · ${esc(a.profissional.endereco)}</dd>
            <dt>Data</dt><dd>${esc(deIso(a.data).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }))} às ${a.hora}</dd>
            <dt>Status</dt><dd>${badge(a.status)}</dd></dl>
            <div class="pp-acoes">
                ${futuro(a) ? `<button type="button" class="btn btn-sm btn-outline-danger" data-cancelar="${a.id}">Cancelar agendamento</button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" disabled title="Em breve">Reagendar (em breve)</button>` : ""}
            </div>`;
    }

    function desenharDia() {
        elDiaTitulo.textContent = deIso(diaSel).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
        const doDia = lista.filter((a) => a.data === diaSel);
        elDiaLista.innerHTML = doDia.map((a) => `<li class="pm-linha pp-borda-${STATUS[a.status].cls}">
            <div class="pm-quando"><strong>${esc(relativo(a))}</strong><span>${a.hora}</span></div>
            <div class="pm-resumo"><strong>${esc(a.servico.nome)}</strong><span>${esc(a.profissional.local)}</span></div>
            ${badge(a.status)}
            <details class="pm-mais"><summary>Detalhes</summary>${detalhes(a)}</details></li>`).join("")
            || '<li class="pp-vazio">Nenhum agendamento neste dia.</li>';
    }

    function desenhar() {
        desenharProximo();
        desenharResumo();
        desenharCalendario();
        desenharDia();
    }

    async function carregar() {
        lista = await apiService.listarAgendamentos({ clienteId });
        desenhar();
    }

    /* ---------- Eventos ---------- */

    document.getElementById("mesAnterior").addEventListener("click", () => { mes.setMonth(mes.getMonth() - 1); desenharCalendario(); });
    document.getElementById("mesSeguinte").addEventListener("click", () => { mes.setMonth(mes.getMonth() + 1); desenharCalendario(); });

    elCalendario.addEventListener("click", (e) => {
        const dia = e.target.closest("[data-dia]");
        if (!dia) return;
        diaSel = dia.dataset.dia;
        desenharCalendario();
        desenharDia();
        document.querySelector(`[data-dia="${diaSel}"]`).focus();
    });

    elProximo.addEventListener("click", (e) => {
        const ver = e.target.closest("[data-ver-dia]");
        if (!ver) return;
        diaSel = ver.dataset.verDia;
        mes = deIso(diaSel); mes.setDate(1);
        desenharCalendario();
        desenharDia();
        document.getElementById("diaTitulo").scrollIntoView({ block: "center" });
    });

    elDiaLista.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-cancelar]");
        if (!botao) return;
        idCancelar = Number(botao.dataset.cancelar);
        const a = lista.find((x) => x.id === idCancelar);
        document.getElementById("cancelarTexto").textContent =
            `${a.servico.nome}, ${relativo(a).toLowerCase()} às ${a.hora}, em ${a.profissional.local}.`;
        bootstrap.Modal.getOrCreateInstance(document.getElementById("modalCancelar")).show();
    });

    document.getElementById("confirmarCancelamento").addEventListener("click", async () => {
        try { await apiService.alterarStatus(idCancelar, "CANCELADO"); } catch (erro) { alert(erro.message); }
        bootstrap.Modal.getOrCreateInstance(document.getElementById("modalCancelar")).hide();
        carregar();
    });

    Comum.montarUsuario(document.getElementById("nav-usuario"), "cliente");
    carregar();
})();
