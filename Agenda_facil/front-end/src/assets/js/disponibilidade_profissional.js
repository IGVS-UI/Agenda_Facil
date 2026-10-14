/*
 * Disponibilidade do profissional: dias e horários de atendimento + bloqueio de horários.
 * Formato (o mesmo do apiService/mock): disponibilidade[diaDaSemana] = ["09:00", "10:00", ...]
 * (0 = domingo ... 6 = sábado) e bloqueios = [{ data: "AAAA-MM-DD", hora: "14:00" }].
 * O cliente só enxerga horários que estão na disponibilidade e não estão bloqueados.
 */
(function () {
    const { esc, iso, deIso } = Comum;
    let profissionalId;

    const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const HORAS = Array.from({ length: 16 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`);   // 06:00 a 21:00
    const PADRAO = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

    const elDias = document.getElementById("dias");
    const elMensagem = document.getElementById("mensagem");
    const elLista = document.getElementById("listaBloqueios");
    const elData = document.getElementById("bloqueioData");
    const elHora = document.getElementById("bloqueioHora");
    const elErro = document.getElementById("bloqueio-erro");

    let disponibilidade = {};
    let bloqueios = [];

    function mensagem(texto, tipo = "ok") {
        elMensagem.className = `pp-status-msg pp-status-msg-${tipo}`;
        elMensagem.textContent = texto;
    }

    /* ---------- Horários por dia da semana ---------- */

    function desenharDias() {
        elDias.innerHTML = DIAS.map((nome, d) => {
            const horas = disponibilidade[d] || [];
            const atende = horas.length > 0;
            return `<div class="pd-dia ${atende ? "pd-dia-ativo" : ""}">
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" id="atende-${d}" data-atende="${d}" ${atende ? "checked" : ""}>
                    <label class="form-check-label" for="atende-${d}"><strong>${nome}</strong>
                        <small>${atende ? `${horas.length} horário(s)` : "Não atende"}</small></label>
                </div>
                ${atende ? `<div class="pd-horas" role="group" aria-label="Horários de ${nome}">
                    ${HORAS.map((h) => `<button type="button" class="pd-hora" data-dia="${d}" data-hora="${h}" aria-pressed="${horas.includes(h)}">${h}</button>`).join("")}
                </div>` : ""}</div>`;
        }).join("");
    }

    elDias.addEventListener("change", (e) => {
        const dia = e.target.dataset.atende;
        if (dia === undefined) return;
        disponibilidade[dia] = e.target.checked ? PADRAO.slice() : [];
        desenharDias();
        document.getElementById(`atende-${dia}`).focus();
        atualizarHorasBloqueio();
    });

    elDias.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-hora]");
        if (!botao) return;
        const dia = botao.dataset.dia, hora = botao.dataset.hora;
        const horas = new Set(disponibilidade[dia] || []);
        if (horas.has(hora)) horas.delete(hora); else horas.add(hora);
        disponibilidade[dia] = [...horas].sort();
        desenharDias();
        document.querySelector(`[data-dia="${dia}"][data-hora="${hora}"]`)?.focus();
        atualizarHorasBloqueio();
    });

    /* ---------- Bloqueios ---------- */

    function horasDoDia(data) {
        return disponibilidade[deIso(data).getDay()] || [];
    }

    function atualizarHorasBloqueio() {
        const horas = elData.value ? horasDoDia(elData.value) : [];
        elHora.innerHTML = `<option value="*">Dia inteiro</option>` + horas.map((h) => `<option value="${h}">${h}</option>`).join("");
    }

    function desenharBloqueios() {
        const ordenados = bloqueios.slice().sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
        elLista.innerHTML = ordenados.map((b) => `<li>
            <span>${esc(deIso(b.data).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }))} às <strong>${b.hora}</strong></span>
            <button type="button" class="btn btn-sm btn-outline-danger" data-remover="${b.data}|${b.hora}"
                aria-label="Remover bloqueio de ${b.data} às ${b.hora}">Remover</button></li>`).join("")
            || '<li class="pp-vazio">Nenhum horário bloqueado.</li>';
    }

    document.getElementById("formBloqueio").addEventListener("submit", (e) => {
        e.preventDefault();
        elErro.textContent = "";
        if (!elData.value) { elErro.textContent = "Escolha a data."; elData.focus(); return; }
        if (elData.value < iso(new Date())) { elErro.textContent = "Não é possível bloquear uma data passada."; elData.focus(); return; }
        const horas = elHora.value === "*" ? horasDoDia(elData.value) : [elHora.value];
        if (!horas.length) { elErro.textContent = "Você não atende neste dia da semana."; elData.focus(); return; }
        horas.forEach((hora) => {
            if (!bloqueios.some((b) => b.data === elData.value && b.hora === hora)) bloqueios.push({ data: elData.value, hora });
        });
        desenharBloqueios();
        mensagem("Bloqueio adicionado. Lembre-se de salvar as alterações.", "aviso");
    });

    elData.min = iso(new Date());
    elData.addEventListener("change", atualizarHorasBloqueio);

    elLista.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-remover]");
        if (!botao) return;
        const [data, hora] = botao.dataset.remover.split("|");
        bloqueios = bloqueios.filter((b) => !(b.data === data && b.hora === hora));
        desenharBloqueios();
        mensagem("Bloqueio removido. Lembre-se de salvar as alterações.", "aviso");
    });

    /* ---------- Salvar ---------- */

    document.getElementById("salvar").addEventListener("click", async () => {
        const limpa = {};
        Object.keys(disponibilidade).forEach((d) => { if (disponibilidade[d].length) limpa[d] = disponibilidade[d]; });
        await apiService.salvarDisponibilidade(profissionalId, { disponibilidade: limpa, bloqueios });
        mensagem("Disponibilidade salva. Os clientes já veem os novos horários.");
    });

    async function iniciar() {
        profissionalId = Comum.USUARIOS.profissional.id;
        Comum.montarUsuario(document.getElementById("nav-usuario"), "profissional");
        const dados = await apiService.obterDisponibilidade(profissionalId);
        disponibilidade = dados.disponibilidade;
        bloqueios = dados.bloqueios;
        desenharDias();
        desenharBloqueios();
        atualizarHorasBloqueio();
    }
    Comum.sessao("profissional").then(iniciar);
})();
