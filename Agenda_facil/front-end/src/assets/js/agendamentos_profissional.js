/*
 * Agenda do profissional: dia (linha do tempo) e semana, com filtro por status.
 * Só carrega os agendamentos do profissional (apiService.listarAgendamentos com profissionalId).
 * Confirmar, concluir e cancelar usam apiService.alterarStatus.
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
    let profissionalId;

    const el = (id) => document.getElementById(id);
    const elTitulo = el("titulo"), elResumo = el("resumo"), elLinha = el("linhaDoTempo"), elSemana = el("semana");
    const elProximo = el("proximoCliente"), elHoje = el("irHoje");

    let todos = [];            // todos os agendamentos do profissional
    let dia = iso(new Date());
    let visao = "dia";         // "dia" | "semana"
    let filtro = "";

    const hoje = () => iso(new Date());
    const badge = (st) => `<span class="pp-status pp-${STATUS[st].cls}">${STATUS[st].rotulo}</span>`;
    const telefone = (t) => t.replace(/\D/g, "");
    const doDia = (id) => todos.filter((a) => a.data === id).sort((a, b) => a.hora.localeCompare(b.hora));
    const passaFiltro = (a) => !filtro || a.status === filtro;

    function acoes(a) {
        if (a.status === "PENDENTE") {
            return `<button type="button" class="btn btn-sm btn-primary" data-status="CONFIRMADO" data-id="${a.id}">Confirmar</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-status="CANCELADO" data-id="${a.id}">Cancelar</button>`;
        }
        if (a.status === "CONFIRMADO") {
            return `<button type="button" class="btn btn-sm btn-primary" data-status="CONCLUIDO" data-id="${a.id}">Concluir</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-status="CANCELADO" data-id="${a.id}">Cancelar</button>`;
        }
        return "";
    }

    // Hoje: o primeiro cliente ativo que ainda não passou do horário. Outros dias: o primeiro ativo.
    function proximo(listaDoDia) {
        const ativos = listaDoDia.filter((a) => ATIVOS.includes(a.status));
        if (dia !== hoje()) return ativos[0] || null;
        const agora = new Date().toTimeString().slice(0, 5);
        return ativos.find((a) => a.hora >= agora) || null;
    }

    // Domingo da semana do dia escolhido
    function inicioDaSemana() {
        const d = deIso(dia);
        d.setDate(d.getDate() - d.getDay());
        return d;
    }

    /* ---------- Título e controles ---------- */

    function desenharTitulo() {
        if (visao === "dia") {
            const extenso = deIso(dia).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
            elTitulo.textContent = `${dia === hoje() ? "Hoje, " : ""}${extenso}`;
            elHoje.disabled = dia === hoje();
        } else {
            const ini = inicioDaSemana(), fim = new Date(ini);
            fim.setDate(fim.getDate() + 6);
            const dm = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
            elTitulo.textContent = `Semana de ${dm(ini)} a ${dm(fim)}`;
            elHoje.disabled = false;
        }
        document.querySelectorAll("[data-visao]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.visao === visao)));
        el("visaoDia").hidden = visao !== "dia";
        el("visaoSemana").hidden = visao !== "semana";
    }

    /* ---------- Visão do dia ---------- */

    function desenharResumo(lista) {
        elResumo.innerHTML = Object.keys(STATUS).map((st) =>
            `<div class="pp-resumo-${STATUS[st].cls}"><dt>${STATUS[st].rotulo}s</dt><dd>${lista.filter((a) => a.status === st).length}</dd></div>`).join("");
    }

    function desenharProximo(lista) {
        const prox = proximo(lista);
        elProximo.hidden = visao !== "dia";
        if (visao !== "dia") return;
        elProximo.innerHTML = prox
            ? `<h2 id="proximoTitulo">Próximo cliente</h2>
               <p class="pp-proximo-hora">${prox.hora}</p>
               <p class="pp-proximo-nome">${esc(prox.cliente.nome)}</p>
               <p>${esc(prox.servico.nome)} · ${prox.servico.duracaoMin} min · ${badge(prox.status)}</p>
               <p><a href="tel:${telefone(prox.cliente.telefone)}">${esc(prox.cliente.telefone)}</a></p>`
            : `<h2 id="proximoTitulo">Próximo cliente</h2><p class="pp-proximo-vazio">Nenhum cliente pendente para o resto do ${dia === hoje() ? "dia" : "dia escolhido"}.</p>`;
    }

    function desenharDia() {
        const lista = doDia(dia);
        desenharResumo(lista);
        desenharProximo(lista);
        const prox = proximo(lista);
        elLinha.innerHTML = lista.filter(passaFiltro).map((a) => `<li>
            <time datetime="${a.hora}">${a.hora}</time>
            <article class="pp-card pp-borda-${STATUS[a.status].cls} ${a.status === "CANCELADO" ? "pp-apagado" : ""}">
                <div class="pp-card-topo"><h2>${esc(a.cliente.nome)}</h2>${badge(a.status)}</div>
                ${prox && prox.id === a.id ? '<p class="pp-proximo">Próximo cliente</p>' : ""}
                <p>${esc(a.servico.nome)} · ${a.servico.duracaoMin} min · ${moeda(a.servico.preco)}</p>
                <p class="pp-tel"><a href="tel:${telefone(a.cliente.telefone)}">${esc(a.cliente.telefone)}</a></p>
                <div class="pp-acoes">${acoes(a)}</div>
            </article></li>`).join("")
            || `<li class="pp-vazio pp-a-vazio">${filtro ? "Nenhum cliente com este status neste dia." : "Nenhum cliente agendado neste dia."}</li>`;
    }

    /* ---------- Visão da semana ---------- */

    function desenharSemana() {
        const ini = inicioDaSemana();
        const dias = [];
        for (let i = 0; i < 7; i++) { const d = new Date(ini); d.setDate(d.getDate() + i); dias.push(d); }
        const semanaInteira = dias.flatMap((d) => doDia(iso(d)));
        desenharResumo(semanaInteira);
        elProximo.hidden = true;

        elSemana.innerHTML = dias.map((d) => {
            const id = iso(d);
            const lista = doDia(id).filter(passaFiltro);
            const ativos = doDia(id).filter((a) => ATIVOS.includes(a.status)).length;
            return `<li class="pp-semana-dia ${id === hoje() ? "pp-semana-hoje" : ""}">
                <button type="button" class="pp-semana-cab" data-ir-dia="${id}" aria-label="Abrir ${d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}">
                    <small>${d.toLocaleDateString("pt-BR", { weekday: "short" })}</small><strong>${d.getDate()}</strong>
                    <span>${ativos} ativo${ativos === 1 ? "" : "s"}</span></button>
                <ul>${lista.map((a) => `<li class="pp-semana-item pp-borda-${STATUS[a.status].cls} ${a.status === "CANCELADO" ? "pp-apagado" : ""}">
                    <strong>${a.hora}</strong> ${esc(a.cliente.nome)}<small>${esc(a.servico.nome)}</small>${badge(a.status)}</li>`).join("")
                    || '<li class="pp-vazio">—</li>'}</ul></li>`;
        }).join("");
    }

    function desenhar() {
        desenharTitulo();
        if (visao === "dia") desenharDia(); else desenharSemana();
    }

    async function carregar() {
        todos = await apiService.listarAgendamentos({ profissionalId });
        desenhar();
    }

    /* ---------- Eventos ---------- */

    function mover(sentido) {
        const d = deIso(dia);
        d.setDate(d.getDate() + sentido * (visao === "semana" ? 7 : 1));
        dia = iso(d);
        desenhar();
    }

    el("anterior").addEventListener("click", () => mover(-1));
    el("seguinte").addEventListener("click", () => mover(1));
    elHoje.addEventListener("click", () => { dia = hoje(); desenhar(); });
    el("filtroStatus").addEventListener("change", (e) => { filtro = e.target.value; desenhar(); });

    document.querySelectorAll("[data-visao]").forEach((b) => b.addEventListener("click", () => { visao = b.dataset.visao; desenhar(); }));

    elSemana.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-ir-dia]");
        if (!botao) return;
        dia = botao.dataset.irDia;
        visao = "dia";
        desenhar();
    });

    elLinha.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-status]");
        if (!botao) return;
        try { await apiService.alterarStatus(botao.dataset.id, botao.dataset.status); } catch (erro) { alert(erro.message); }
        carregar();
    });

    Comum.sessao("profissional").then(() => {
        profissionalId = Comum.USUARIOS.profissional.id;
        Comum.montarUsuario(el("nav-usuario"), "profissional");
        carregar();
    });
})();
