/*
 * Dados simulados do Agenda Fácil (usados enquanto a API não existe).
 * Só o apiService.js deve ler este arquivo. As páginas nunca acessam MockData direto.
 * Quando o back-end estiver pronto, este arquivo deixa de ser carregado.
 */

// Gera uma data (AAAA-MM-DD) relativa a hoje, para os exemplos nunca ficarem "no passado".
function dataRelativa(dias) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mes}-${dia}`;
}

const MockData = {
    // Cliente "logado" durante a prototipação (a autenticação real virá do Firebase)
    clienteAtualId: 1,

    clientes: [
        { id: 1, nome: "Igor Silva", email: "igor@email.com", telefone: "(11) 91234-5678" },
        { id: 2, nome: "Ana Souza", email: "ana@email.com", telefone: "(11) 98765-4321" },
        { id: 3, nome: "Pedro Lima", email: "pedro@email.com", telefone: "(11) 97777-1212" },
        { id: 4, nome: "Carlos Mendes", email: "carlos@email.com", telefone: "(11) 96666-3434" },
        { id: 5, nome: "Julia Prado", email: "julia@email.com", telefone: "(11) 95555-7878" }
    ],

    /*
     * Localizações de exemplo do cliente e a distância (km) de cada profissional a partir delas.
     * Só existe no mock: na versão final a distância é calculada no back-end a partir da
     * localização real do cliente (latitude/longitude).
     */
    origens: [
        { id: "centro", nome: "Centro", distancias: { 1: 0.8, 2: 1.4, 3: 2.1, 4: 3.5 } },
        { id: "jardim", nome: "Jardim América", distancias: { 1: 2.6, 2: 0.4, 3: 3.8, 4: 1.9 } },
        { id: "vila", nome: "Vila Nova", distancias: { 1: 3.0, 2: 3.2, 3: 0.6, 4: 2.2 } }
    ],

    servicos: [
        { id: 1, nome: "Corte de cabelo", categoria: "Barbearia", descricao: "Corte masculino com acabamento na navalha.", duracaoMin: 45, preco: 45.0, ativo: true, popular: true },
        { id: 2, nome: "Barba", categoria: "Barbearia", descricao: "Barba modelada com toalha quente.", duracaoMin: 30, preco: 30.0, ativo: true, popular: true },
        { id: 3, nome: "Manicure e pedicure", categoria: "Beleza", descricao: "Cuidado completo para mãos e pés.", duracaoMin: 90, preco: 70.0, ativo: true, popular: true },
        { id: 4, nome: "Massagem relaxante", categoria: "Bem-estar", descricao: "Sessão de 60 minutos para aliviar tensões.", duracaoMin: 60, preco: 120.0, ativo: true, popular: false },
        { id: 5, nome: "Limpeza de pele", categoria: "Beleza", descricao: "Limpeza profunda com hidratação.", duracaoMin: 60, preco: 95.0, ativo: true, popular: false },
        { id: 6, nome: "Consulta de nutrição", categoria: "Saúde", descricao: "Avaliação e plano alimentar personalizado.", duracaoMin: 50, preco: 150.0, ativo: true, popular: true }
    ],

    /*
     * Profissionais/locais.
     * distanciaKm é fictício: serve só para a tela ordenar por proximidade.
     * Na etapa de localização, será calculado a partir de latitude/longitude.
     * disponibilidade: dia da semana (0 = domingo ... 6 = sábado) -> horários oferecidos.
     * bloqueios: horários que o profissional bloqueou manualmente.
     */
    profissionais: [
        {
            id: 1, nome: "João Barbosa", latitude: -23.5617, longitude: -46.6559, local: "Barbearia do João", endereco: "Rua das Flores, 120 - Centro",
            distanciaKm: 0.8, avaliacao: 4.8, servicosIds: [1, 2],
            disponibilidade: {
                1: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"],
                2: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"],
                3: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"],
                4: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"],
                5: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"],
                6: ["09:00", "10:00", "11:00", "12:00"]
            },
            bloqueios: [{ data: dataRelativa(2), hora: "14:00" }]
        },
        {
            id: 2, nome: "Marina Alves", latitude: -23.567, longitude: -46.662, local: "Studio Marina Alves", endereco: "Av. Brasil, 850 - Jardim América",
            distanciaKm: 1.4, avaliacao: 4.9, servicosIds: [3, 5],
            disponibilidade: {
                2: ["09:00", "11:00", "14:00", "16:00"],
                3: ["09:00", "11:00", "14:00", "16:00"],
                4: ["09:00", "11:00", "14:00", "16:00"],
                5: ["09:00", "11:00", "14:00", "16:00"],
                6: ["09:00", "11:00", "13:00"]
            },
            bloqueios: []
        },
        {
            id: 3, nome: "Carla Mendes", latitude: -23.575, longitude: -46.64, local: "Espaço Equilíbrio", endereco: "Rua das Palmeiras, 45 - Vila Nova",
            distanciaKm: 2.1, avaliacao: 4.7, servicosIds: [4, 5],
            disponibilidade: {
                1: ["10:00", "11:00", "15:00", "16:00", "17:00"],
                3: ["10:00", "11:00", "15:00", "16:00", "17:00"],
                5: ["10:00", "11:00", "15:00", "16:00", "17:00"]
            },
            bloqueios: []
        },
        {
            id: 4, nome: "Dr. Rafael Costa", latitude: -23.55, longitude: -46.633, local: "Clínica Viva Bem", endereco: "Rua XV de Novembro, 300 - Centro",
            distanciaKm: 3.5, avaliacao: 5.0, servicosIds: [6],
            disponibilidade: {
                2: ["08:00", "09:00", "10:00", "14:00", "15:00"],
                4: ["08:00", "09:00", "10:00", "14:00", "15:00"]
            },
            bloqueios: []
        }
    ],

    /*
     * Agendamentos de exemplo (8), cobrindo os quatro status.
     * status: PENDENTE | CONFIRMADO | CONCLUIDO | CANCELADO
     * Só PENDENTE e CONFIRMADO ocupam o horário.
     */
    agendamentos: [
        { id: 1, clienteId: 1, servicoId: 1, profissionalId: 1, data: dataRelativa(1), hora: "10:00", status: "CONFIRMADO" },
        { id: 2, clienteId: 1, servicoId: 3, profissionalId: 2, data: dataRelativa(3), hora: "14:00", status: "PENDENTE" },
        { id: 3, clienteId: 1, servicoId: 2, profissionalId: 1, data: dataRelativa(-7), hora: "11:00", status: "CONCLUIDO" },
        { id: 4, clienteId: 1, servicoId: 4, profissionalId: 3, data: dataRelativa(-14), hora: "15:00", status: "CANCELADO" },
        { id: 5, clienteId: 2, servicoId: 1, profissionalId: 1, data: dataRelativa(1), hora: "13:00", status: "PENDENTE" },
        { id: 6, clienteId: 3, servicoId: 6, profissionalId: 4, data: dataRelativa(2), hora: "09:00", status: "CONFIRMADO" },
        { id: 7, clienteId: 2, servicoId: 5, profissionalId: 2, data: dataRelativa(-3), hora: "09:00", status: "CONCLUIDO" },
        { id: 8, clienteId: 3, servicoId: 4, profissionalId: 3, data: dataRelativa(4), hora: "16:00", status: "PENDENTE" },
        // Agenda de hoje do profissional 1 (João), para o dashboard do dia
        { id: 9, clienteId: 4, servicoId: 1, profissionalId: 1, data: dataRelativa(0), hora: "09:00", status: "CONCLUIDO" },
        { id: 10, clienteId: 2, servicoId: 2, profissionalId: 1, data: dataRelativa(0), hora: "10:00", status: "CONFIRMADO" },
        { id: 11, clienteId: 5, servicoId: 1, profissionalId: 1, data: dataRelativa(0), hora: "11:00", status: "PENDENTE" },
        { id: 12, clienteId: 3, servicoId: 1, profissionalId: 1, data: dataRelativa(0), hora: "14:00", status: "CONFIRMADO" },
        { id: 13, clienteId: 1, servicoId: 2, profissionalId: 1, data: dataRelativa(0), hora: "16:00", status: "CANCELADO" }
    ]
};
