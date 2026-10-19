/*
 * Meus serviços (profissional): listar, criar, editar e desativar/ativar.
 * Só mostra e altera os serviços do próprio profissional (apiService com profissionalId).
 */
(function () {
    const { esc, moeda } = Comum;
    let profissionalId;

    const elLista = document.getElementById("listaServicos");
    const elMensagem = document.getElementById("mensagem");
    const form = document.getElementById("formServico");
    const modal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById("modalServico"));

    const CAMPOS = ["nome", "categoria", "descricao", "duracao", "preco"];
    let servicos = [];
    let editandoId = null;

    function mensagem(texto, tipo = "ok") {
        elMensagem.className = `pp-status-msg pp-status-msg-${tipo}`;
        elMensagem.textContent = texto;
    }

    /* ---------- Lista ---------- */

    function desenhar() {
        elLista.innerHTML = servicos.map((s) => `<tr class="${s.ativo ? "" : "pp-apagado"}">
            <th scope="row">${esc(s.nome)}<small>${esc(s.categoria)} · ${esc(s.descricao)}</small></th>
            <td>${s.duracaoMin} min</td>
            <td>${moeda(s.preco)}</td>
            <td><span class="pp-status ${s.ativo ? "pp-concluido" : "pp-cancelado"}">${s.ativo ? "Ativo" : "Desativado"}</span></td>
            <td class="pv-acoes">
                <button type="button" class="btn btn-sm btn-outline-primary" data-editar="${s.id}" aria-label="Editar ${esc(s.nome)}">Editar</button>
                <button type="button" class="btn btn-sm ${s.ativo ? "btn-outline-danger" : "btn-outline-success"}" data-alternar="${s.id}"
                    aria-label="${s.ativo ? "Desativar" : "Ativar"} ${esc(s.nome)}">${s.ativo ? "Desativar" : "Ativar"}</button>
                <button type="button" class="btn btn-sm btn-link text-danger" data-excluir="${s.id}" aria-label="Excluir ${esc(s.nome)}">Excluir</button>
            </td></tr>`).join("")
            || '<tr><td colspan="5" class="pp-vazio">Você ainda não cadastrou serviços. Use "Novo serviço".</td></tr>';
    }

    async function carregar() {
        servicos = await apiService.listarServicos({ apenasAtivos: false, profissionalId });
        desenhar();
    }

    /* ---------- Formulário ---------- */

    const campo = (id) => document.getElementById(id);

    function mostrarErro(id, msg) {
        document.getElementById(`${id}-erro`).textContent = msg;
        campo(id).classList.toggle("is-invalid", Boolean(msg));
        if (msg) campo(id).setAttribute("aria-invalid", "true"); else campo(id).removeAttribute("aria-invalid");
    }

    function validar() {
        const regras = {
            nome: () => campo("nome").value.trim() ? "" : "Informe o nome do serviço.",
            categoria: () => campo("categoria").value.trim() ? "" : "Informe a categoria.",
            descricao: () => campo("descricao").value.trim() ? "" : "Descreva o serviço em poucas palavras.",
            duracao: () => Number(campo("duracao").value) >= 5 ? "" : "A duração deve ser de pelo menos 5 minutos.",
            preco: () => campo("preco").value !== "" && Number(campo("preco").value) >= 0 ? "" : "Informe o preço (use 0 se for gratuito)."
        };
        let primeiroInvalido = null;
        CAMPOS.forEach((id) => {
            const msg = regras[id]();
            mostrarErro(id, msg);
            if (msg && !primeiroInvalido) primeiroInvalido = campo(id);
        });
        if (primeiroInvalido) primeiroInvalido.focus();
        return !primeiroInvalido;
    }

    function abrirFormulario(servico) {
        editandoId = servico ? servico.id : null;
        document.getElementById("modalServicoTitulo").textContent = servico ? "Editar serviço" : "Novo serviço";
        campo("nome").value = servico ? servico.nome : "";
        campo("categoria").value = servico ? servico.categoria : "";
        campo("descricao").value = servico ? servico.descricao : "";
        campo("duracao").value = servico ? servico.duracaoMin : 30;
        campo("preco").value = servico ? servico.preco : "";
        CAMPOS.forEach((id) => mostrarErro(id, ""));
        modal().show();
    }

    document.getElementById("modalServico").addEventListener("shown.bs.modal", () => campo("nome").focus());

    form.addEventListener("input", (e) => { if (e.target.classList.contains("is-invalid")) validar(); });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!validar()) return;
        const dados = {
            nome: campo("nome").value.trim(),
            categoria: campo("categoria").value.trim(),
            descricao: campo("descricao").value.trim(),
            duracaoMin: Number(campo("duracao").value),
            preco: Number(campo("preco").value)
        };
        if (editandoId) {
            await apiService.atualizarServico(editandoId, dados);
            mensagem(`Serviço "${dados.nome}" atualizado.`);
        } else {
            await apiService.criarServico({ ...dados, profissionalId });
            mensagem(`Serviço "${dados.nome}" criado. Os clientes já podem agendá-lo.`);
        }
        modal().hide();
        carregar();
    });

    /* ---------- Eventos da lista ---------- */

    document.getElementById("novoServico").addEventListener("click", () => abrirFormulario(null));

    elLista.addEventListener("click", async (e) => {
        const editar = e.target.closest("[data-editar]");
        if (editar) { abrirFormulario(servicos.find((s) => s.id === Number(editar.dataset.editar))); return; }
        const excluir = e.target.closest("[data-excluir]");
        if (excluir) {
            const servico = servicos.find((s) => s.id === Number(excluir.dataset.excluir));
            if (!confirm(`Excluir o serviço "${servico.nome}"? Esta ação não pode ser desfeita.`)) return;
            try {
                await apiService.excluirServico(servico.id);
                mensagem(`"${servico.nome}" foi excluído.`);
            } catch (erro) {
                mensagem(erro.message, "aviso");      // ex.: já tem agendamentos -> use "Desativar"
            }
            await carregar();
            return;
        }
        const alternar = e.target.closest("[data-alternar]");
        if (alternar) {
            const servico = servicos.find((s) => s.id === Number(alternar.dataset.alternar));
            await apiService.atualizarServico(servico.id, { ativo: !servico.ativo });
            mensagem(servico.ativo
                ? `"${servico.nome}" foi desativado e não aparece mais para os clientes.`
                : `"${servico.nome}" foi ativado e já pode ser agendado.`, servico.ativo ? "aviso" : "ok");
            await carregar();
            const botao = elLista.querySelector(`[data-alternar="${servico.id}"]`);
            if (botao) botao.focus();
        }
    });

    Comum.sessao("profissional").then(() => {
        profissionalId = Comum.USUARIOS.profissional.id;
        Comum.montarUsuario(document.getElementById("nav-usuario"), "profissional");
        carregar();
    });
})();
