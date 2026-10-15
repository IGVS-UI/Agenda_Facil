/*
 * apiService: única porta de entrada do front-end para os dados.
 * As páginas chamam apenas apiService.xxx() e nunca sabem de onde os dados vêm.
 *
 *   Hoje:       páginas -> apiService -> mock (localStorage)
 *   Depois:     páginas -> apiService -> fetch -> Node + Express -> MySQL
 *
 * Para trocar, basta mudar API_MODO para "http". As páginas não mudam.
 * Todas as funções retornam Promises (como fetch), para o código das páginas ser o mesmo nos dois modos.
 *
 * Requer mock-data.js carregado antes deste arquivo.
 */

/*
 * Modo de dados: "mock" (localStorage) ou "http" (API Node/Express).
 * Para testar com a API sem editar o código, abra qualquer página com ?api=http
 * (volta ao mock com ?api=mock). A escolha fica guardada na aba do navegador.
 */
const CHAVE_MODO = "agendaFacil:apiModo";
function escolherModo() {
    const padrao = "mock";   // troque para "http" quando a API for o padrão
    try {
        const pedido = new URLSearchParams(location.search).get("api");
        if (pedido === "http" || pedido === "mock") sessionStorage.setItem(CHAVE_MODO, pedido);
        return sessionStorage.getItem(CHAVE_MODO) || padrao;
    } catch (erro) {
        return padrao;
    }
}
const API_MODO = escolherModo();               // "mock" | "http"
const API_URL = "http://localhost:3000/api";   // usado só no modo "http"

const CHAVE_STORAGE = "agendaFacil:dados:v3";   // v3: profissionais com latitude/longitude

// Status em que o horário continua ocupado
const STATUS_OCUPAM_HORARIO = ["PENDENTE", "CONFIRMADO"];

// Transições permitidas (a regra definitiva ficará no back-end)
const TRANSICOES_STATUS = {
    PENDENTE: ["CONFIRMADO", "CANCELADO"],
    CONFIRMADO: ["CONCLUIDO", "CANCELADO"],
    CONCLUIDO: [],
    CANCELADO: []
};

/* ---------- Persistência do mock (localStorage) ---------- */

function copiar(valor) {
    return JSON.parse(JSON.stringify(valor));
}

function carregarBanco() {
    try {
        const salvo = localStorage.getItem(CHAVE_STORAGE);
        if (salvo) return JSON.parse(salvo);
    } catch (erro) {
        // localStorage indisponível ou corrompido: recomeça com os dados de exemplo
    }
    return copiar(MockData);
}

function salvarBanco(banco) {
    try {
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(banco));
    } catch (erro) {
        // sem localStorage, as alterações valem apenas até recarregar a página
    }
}

function proximoId(lista) {
    return lista.reduce((maior, item) => Math.max(maior, item.id), 0) + 1;
}

function erroApi(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.codigo = codigo;
    return erro;
}

/* ---------- Regras de horário ---------- */

function horarioJaPassou(data, hora) {
    return new Date(`${data}T${hora}:00`) < new Date();
}

/*
 * Estado de um horário (mesma regra da API):
 *   "disponivel"   - pode ser escolhido
 *   "ocupado"      - o tempo do serviço se sobrepõe a um agendamento pendente/confirmado
 *   "indisponivel" - bloqueado pelo profissional ou já passou
 * Compara intervalos: um serviço de 90 min às 09:00 ocupa até 10:30.
 */
const minutosDe = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const seSobrepoem = (a, b) => a.inicio < b.fim && b.inicio < a.fim;

function estadoDoHorario(banco, profissional, data, hora, duracao = 60, ignorarId) {
    const pedido = { inicio: minutosDe(hora), fim: minutosDe(hora) + duracao };
    if (horarioJaPassou(data, hora)) return "indisponivel";

    const bloqueado = profissional.bloqueios.some(b => b.data === data && seSobrepoem(pedido, { inicio: minutosDe(b.hora), fim: minutosDe(b.hora) + 60 }));
    if (bloqueado) return "indisponivel";

    const ocupado = banco.agendamentos.some(a => {
        if (a.profissionalId !== profissional.id || a.data !== data || !STATUS_OCUPAM_HORARIO.includes(a.status) || a.id === ignorarId) return false;
        const servico = banco.servicos.find(s => s.id === a.servicoId);
        return seSobrepoem(pedido, { inicio: minutosDe(a.hora), fim: minutosDe(a.hora) + (servico ? servico.duracaoMin : 60) });
    });
    return ocupado ? "ocupado" : "disponivel";
}

// Distância em linha reta entre dois pontos (fórmula de Haversine), em km — a mesma conta da API
function distanciaKm(lat1, lon1, lat2, lon2) {
    const rad = (g) => (g * Math.PI) / 180;
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/* ---------- Implementação MOCK ---------- */

const apiMock = {
    // GET /api/servicos
    // Com profissionalId, devolve só os serviços daquele profissional (com apenasAtivos: false, inclui os desativados)
    async listarServicos({ apenasAtivos = true, profissionalId } = {}) {
        const banco = carregarBanco();
        let lista = apenasAtivos ? banco.servicos.filter(s => s.ativo) : banco.servicos;
        if (profissionalId) {
            const profissional = banco.profissionais.find(p => p.id === Number(profissionalId));
            lista = lista.filter(s => profissional && profissional.servicosIds.includes(s.id));
        }
        return copiar(lista);
    },

    // GET /api/profissionais?servicoId=&latitude=&longitude=&raioKm=   (ou ?origem=, posições de exemplo)
    // Com latitude/longitude: só os locais até raioKm (padrão 30), do mais próximo ao mais distante.
    async listarProfissionais({ servicoId, origem, latitude, longitude, raioKm = 30 } = {}) {
        const banco = carregarBanco();
        let lista = banco.profissionais;
        if (servicoId) lista = lista.filter(p => p.servicosIds.includes(Number(servicoId)));
        if (latitude !== undefined && longitude !== undefined) {
            return copiar(lista
                .filter(p => p.latitude != null && p.longitude != null)
                .map(p => ({ ...p, distanciaKm: Math.round(distanciaKm(Number(latitude), Number(longitude), p.latitude, p.longitude) * 10) / 10 }))
                .filter(p => p.distanciaKm <= Number(raioKm))
                .sort((a, b) => a.distanciaKm - b.distanciaKm));
        }
        const local = (MockData.origens || []).find(o => o.id === origem);
        const comDistancia = lista.map(p => ({ ...p, distanciaKm: local ? local.distancias[p.id] : p.distanciaKm }));
        return copiar(comDistancia.sort((a, b) => a.distanciaKm - b.distanciaKm));
    },

    // GET /api/localizacao?cep=  — no modo simulado não há internet: só funciona com a API ligada
    async buscarLocalizacaoPorCep() {
        throw erroApi("A busca por CEP precisa da API ligada (abra a página com ?api=http). Use a sua localização ou o local de exemplo.", 400);
    },

    // Só no mock: localizações de exemplo para testar a lista por proximidade
    async listarOrigens() {
        return copiar((MockData.origens || []).map(o => ({ id: o.id, nome: o.nome })));
    },

    // GET /api/horarios-disponiveis?profissionalId=&data=AAAA-MM-DD[&servicoId=]
    // Retorna [{ hora: "10:00", estado: "disponivel" | "ocupado" | "indisponivel" }]
    async listarHorariosDisponiveis({ profissionalId, data, servicoId }) {
        const banco = carregarBanco();
        const profissional = banco.profissionais.find(p => p.id === Number(profissionalId));
        if (!profissional) throw erroApi("Profissional não encontrado.", 404);

        const diaSemana = new Date(`${data}T00:00:00`).getDay();
        const horas = profissional.disponibilidade[diaSemana] || [];
        const servico = banco.servicos.find(s => s.id === Number(servicoId));
        const duracao = servico ? servico.duracaoMin : 60;
        return horas.map(hora => ({ hora, estado: estadoDoHorario(banco, profissional, data, hora, duracao) }));
    },

    // POST /api/agendamentos
    async criarAgendamento({ clienteId, servicoId, profissionalId, data, hora }) {
        const banco = carregarBanco();
        const profissional = banco.profissionais.find(p => p.id === Number(profissionalId));
        if (!profissional) throw erroApi("Profissional não encontrado.", 404);

        // O back-end repetirá esta verificação: é ele quem impede conflitos de verdade.
        const horarios = await apiMock.listarHorariosDisponiveis({ profissionalId, data, servicoId });
        const escolhido = horarios.find(h => h.hora === hora);
        if (!escolhido || escolhido.estado !== "disponivel") {
            throw erroApi("Este horário não está mais disponível.", 409);
        }

        const novo = {
            id: proximoId(banco.agendamentos),
            clienteId: Number(clienteId),
            servicoId: Number(servicoId),
            profissionalId: Number(profissionalId),
            data,
            hora,
            status: "PENDENTE"
        };
        banco.agendamentos.push(novo);
        salvarBanco(banco);
        return copiar(novo);
    },

    // GET /api/agendamentos?clienteId=&profissionalId=&status=&data=
    async listarAgendamentos({ clienteId, profissionalId, status, data } = {}) {
        const banco = carregarBanco();
        let lista = banco.agendamentos;
        if (clienteId) lista = lista.filter(a => a.clienteId === Number(clienteId));
        if (profissionalId) lista = lista.filter(a => a.profissionalId === Number(profissionalId));
        if (status) lista = lista.filter(a => a.status === status);
        if (data) lista = lista.filter(a => a.data === data);

        // Junta nomes para as telas não precisarem cruzar listas
        const completa = lista.map(a => ({
            ...a,
            servico: banco.servicos.find(s => s.id === a.servicoId),
            profissional: banco.profissionais.find(p => p.id === a.profissionalId),
            cliente: banco.clientes.find(c => c.id === a.clienteId)
        }));
        completa.sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
        return copiar(completa);
    },

    // PATCH /api/agendamentos/:id/status
    async alterarStatus(id, novoStatus) {
        const banco = carregarBanco();
        const agendamento = banco.agendamentos.find(a => a.id === Number(id));
        if (!agendamento) throw erroApi("Agendamento não encontrado.", 404);

        if (!TRANSICOES_STATUS[agendamento.status].includes(novoStatus)) {
            throw erroApi(`Não é possível mudar de ${agendamento.status} para ${novoStatus}.`, 400);
        }
        agendamento.status = novoStatus;
        salvarBanco(banco);
        return copiar(agendamento);
    },

    // PUT /api/agendamentos/:id  (reagendar: muda data e hora)
    async atualizarAgendamento(id, { data, hora }) {
        const banco = carregarBanco();
        const agendamento = banco.agendamentos.find(a => a.id === Number(id));
        if (!agendamento) throw erroApi("Agendamento não encontrado.", 404);
        if (!STATUS_OCUPAM_HORARIO.includes(agendamento.status)) {
            throw erroApi("Só é possível reagendar agendamentos pendentes ou confirmados.", 400);
        }

        const horarios = await apiMock.listarHorariosDisponiveis({ profissionalId: agendamento.profissionalId, data });
        const escolhido = horarios.find(h => h.hora === hora);
        if (!escolhido || escolhido.estado !== "disponivel") {
            throw erroApi("Este horário não está disponível.", 409);
        }
        agendamento.data = data;
        agendamento.hora = hora;
        salvarBanco(banco);
        return copiar(agendamento);
    },

    // DELETE /api/agendamentos/:id
    async excluirAgendamento(id) {
        const banco = carregarBanco();
        banco.agendamentos = banco.agendamentos.filter(a => a.id !== Number(id));
        salvarBanco(banco);
    },

    /* ----- Área do profissional: serviços ----- */

    // POST /api/servicos  (dados.profissionalId liga o serviço ao profissional que o criou)
    async criarServico({ profissionalId, ...dados }) {
        const banco = carregarBanco();
        const novo = { id: proximoId(banco.servicos), ativo: true, popular: false, ...dados };
        banco.servicos.push(novo);
        const profissional = banco.profissionais.find(p => p.id === Number(profissionalId));
        if (profissional) profissional.servicosIds.push(novo.id);
        salvarBanco(banco);
        return copiar(novo);
    },

    // PUT /api/servicos/:id  (também usado para ativar/desativar: { ativo: false })
    async atualizarServico(id, dados) {
        const banco = carregarBanco();
        const servico = banco.servicos.find(s => s.id === Number(id));
        if (!servico) throw erroApi("Serviço não encontrado.", 404);
        Object.assign(servico, dados);
        salvarBanco(banco);
        return copiar(servico);
    },

    // DELETE /api/servicos/:id  (só serviço que nunca foi agendado)
    async excluirServico(id) {
        const banco = carregarBanco();
        if (banco.agendamentos.some(a => a.servicoId === Number(id))) {
            throw erroApi("Este serviço já tem agendamentos e não pode ser excluído. Desative-o para que não apareça mais aos clientes.", 409);
        }
        banco.servicos = banco.servicos.filter(s => s.id !== Number(id));
        banco.profissionais.forEach(pr => { pr.servicosIds = pr.servicosIds.filter(sid => sid !== Number(id)); });
        salvarBanco(banco);
    },

    /* ----- Área do profissional: disponibilidade ----- */

    // GET /api/profissionais/:id/disponibilidade
    async obterDisponibilidade(profissionalId) {
        const banco = carregarBanco();
        const profissional = banco.profissionais.find(p => p.id === Number(profissionalId));
        if (!profissional) throw erroApi("Profissional não encontrado.", 404);
        return copiar({ disponibilidade: profissional.disponibilidade, bloqueios: profissional.bloqueios });
    },

    // PUT /api/profissionais/:id/disponibilidade
    async salvarDisponibilidade(profissionalId, { disponibilidade, bloqueios }) {
        const banco = carregarBanco();
        const profissional = banco.profissionais.find(p => p.id === Number(profissionalId));
        if (!profissional) throw erroApi("Profissional não encontrado.", 404);
        profissional.disponibilidade = disponibilidade;
        profissional.bloqueios = bloqueios;
        salvarBanco(banco);
        return copiar({ disponibilidade, bloqueios });
    },

    /* ----- Utilitário de desenvolvimento ----- */

    // Volta tudo para os dados de exemplo
    async restaurarDadosExemplo() {
        salvarBanco(copiar(MockData));
    }
};

/* ---------- Implementação HTTP (usada quando a API existir) ---------- */

// Quem está chamando.
//   login real (authService em modo firebase): "Authorization: Bearer <token do Firebase>"
//   desenvolvimento (a API em AUTH_MODO=fake):  cabeçalho X-Usuario-Id
async function cabecalhosDeIdentidade() {
    if (typeof AuthService !== "undefined" && AuthService.modo === "firebase") {
        const token = await AuthService.obterToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }
    const usuario = typeof Comum !== "undefined" && Comum.usuarioAtual ? Comum.usuarioAtual() : null;
    return usuario ? { "X-Usuario-Id": String(usuario.usuarioId) } : {};
}

async function requisicao(metodo, caminho, corpo) {
    let resposta;
    try {
        resposta = await fetch(`${API_URL}${caminho}`, {
            method: metodo,
            headers: { "Content-Type": "application/json", ...(await cabecalhosDeIdentidade()) },
            body: corpo ? JSON.stringify(corpo) : undefined
        });
    } catch (erro) {
        throw erroApi("Não foi possível falar com o servidor. Confira se a API está ligada.", 0);
    }
    if (!resposta.ok) {
        const detalhe = await resposta.json().catch(() => ({}));
        const erro = erroApi(detalhe.mensagem || "Erro ao comunicar com o servidor.", resposta.status);
        erro.codigoApi = detalhe.codigo;        // ex.: CADASTRO_INCOMPLETO
        throw erro;
    }
    return resposta.status === 204 ? null : resposta.json();
}

function montarQuery(filtros) {
    const params = new URLSearchParams();
    Object.entries(filtros || {}).forEach(([chave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== "") params.append(chave, valor);
    });
    const texto = params.toString();
    return texto ? `?${texto}` : "";
}

const apiHttp = {
    listarServicos: (f) => requisicao("GET", `/servicos${montarQuery(f)}`),
    listarProfissionais: (f) => requisicao("GET", `/profissionais${montarQuery(f)}`),
    listarOrigens: () => requisicao("GET", "/origens"),
    buscarLocalizacaoPorCep: (cep) => requisicao("GET", `/localizacao${montarQuery({ cep })}`),
    listarHorariosDisponiveis: (f) => requisicao("GET", `/horarios-disponiveis${montarQuery(f)}`),
    criarAgendamento: (d) => requisicao("POST", "/agendamentos", d),
    listarAgendamentos: (f) => requisicao("GET", `/agendamentos${montarQuery(f)}`),
    alterarStatus: (id, status) => requisicao("PATCH", `/agendamentos/${id}/status`, { status }),
    atualizarAgendamento: (id, d) => requisicao("PUT", `/agendamentos/${id}`, d),
    excluirAgendamento: (id) => requisicao("DELETE", `/agendamentos/${id}`),
    criarServico: (d) => requisicao("POST", "/servicos", d),
    atualizarServico: (id, d) => requisicao("PUT", `/servicos/${id}`, d),
    excluirServico: (id) => requisicao("DELETE", `/servicos/${id}`),
    obterDisponibilidade: (id) => requisicao("GET", `/profissionais/${id}/disponibilidade`),
    salvarDisponibilidade: (id, d) => requisicao("PUT", `/profissionais/${id}/disponibilidade`, d),
    restaurarDadosExemplo: async () => {}
};

const apiService = API_MODO === "http" ? apiHttp : apiMock;
