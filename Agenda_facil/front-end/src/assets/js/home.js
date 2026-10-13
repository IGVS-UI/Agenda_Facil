/*
 * Página inicial: preenche "Serviços populares" com os dados do apiService
 * (hoje mock, depois API) e atualiza o ano do rodapé.
 */
(function () {
    const listaPopulares = document.getElementById("listaPopulares");

    // Ícone (Bootstrap Icons) de cada categoria de serviço
    const ICONES = {
        "Barbearia": "bi-scissors",
        "Beleza": "bi-flower1",
        "Bem-estar": "bi-flower2",
        "Saúde": "bi-heart-pulse"
    };

    // Evita que texto vindo dos dados vire HTML
    function texto(valor) {
        const span = document.createElement("span");
        span.textContent = valor;
        return span.innerHTML;
    }

    function desenharPopulares(servicos) {
        const populares = servicos.filter((s) => s.popular);
        listaPopulares.innerHTML = populares.map((s) => `
            <li>
                <span class="icone-circulo" aria-hidden="true"><i class="bi ${ICONES[s.categoria] || "bi-calendar-check"}"></i></span>
                <strong>${texto(s.nome)}</strong>
                <span class="cartao-descricao">${texto(s.descricao)}</span>
                <a class="cartao-link" href="servicos_usuario.html?servico=${s.id}">Agendar <i class="bi bi-arrow-right" aria-hidden="true"></i><span class="visually-hidden"> ${texto(s.nome)}</span></a>
            </li>`).join("") || '<li class="cards-servicos-vazio">Nenhum serviço disponível no momento.</li>';
    }

    async function iniciar() {
        document.getElementById("anoAtual").textContent = new Date().getFullYear();
        try {
            desenharPopulares(await apiService.listarServicos());
        } catch (erro) {
            listaPopulares.innerHTML = '<li class="cards-servicos-vazio">Não foi possível carregar os serviços.</li>';
        }
    }

    iniciar();
})();
