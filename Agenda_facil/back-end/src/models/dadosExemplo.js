/*
 * Dados de exemplo do Agenda Fácil (os mesmos de database/dados_exemplo.sql, com os mesmos ids).
 * Usados pelo modelo em memória e, nos testes, para recarregar o banco MySQL de teste.
 * As datas são relativas a hoje. Status em MAIÚSCULAS (formato do front; o banco guarda minúsculo).
 */

const pad = (n) => String(n).padStart(2, "0");
const isoData = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dataRelativa = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return isoData(d); };
const horas = (...hs) => hs.map((h) => `${pad(h)}:00`);

function gerar() {
    let usuarios, profissionais, servicos, disponibilidadeSemanal, bloqueios, agendamentos;

    usuarios = [
        { id: 1, nome: "Igor Silva", email: "igor@exemplo.com", telefone: "(11) 91234-5678", tipo: "cliente" },
        { id: 2, nome: "Ana Souza", email: "ana@exemplo.com", telefone: "(11) 98765-4321", tipo: "cliente" },
        { id: 3, nome: "Pedro Lima", email: "pedro@exemplo.com", telefone: "(11) 97777-1212", tipo: "cliente" },
        { id: 4, nome: "Carlos Mendes", email: "carlos@exemplo.com", telefone: "(11) 96666-3434", tipo: "cliente" },
        { id: 5, nome: "Julia Prado", email: "julia@exemplo.com", telefone: "(11) 95555-7878", tipo: "cliente" },
        { id: 6, nome: "João Barbosa", email: "joao@exemplo.com", telefone: "(11) 94444-0001", tipo: "profissional" },
        { id: 7, nome: "Marina Alves", email: "marina@exemplo.com", telefone: "(11) 94444-0002", tipo: "profissional" },
        { id: 8, nome: "Carla Mendes", email: "carla@exemplo.com", telefone: "(11) 94444-0003", tipo: "profissional" },
        { id: 9, nome: "Rafael Costa", email: "rafael@exemplo.com", telefone: "(11) 94444-0004", tipo: "profissional" }
    ];

    // avaliacao ainda não existe no banco (funcionalidade futura): aqui é um valor fixo de exemplo
    profissionais = [
        { id: 1, usuarioId: 6, nomeLocal: "Barbearia do João", logradouro: "Rua das Flores", numero: "120", bairro: "Centro", cidade: "São Paulo", uf: "SP", latitude: -23.5617, longitude: -46.6559, avaliacao: 4.8, ativo: true },
        { id: 2, usuarioId: 7, nomeLocal: "Studio Marina Alves", logradouro: "Av. Brasil", numero: "850", bairro: "Jardim América", cidade: "São Paulo", uf: "SP", latitude: -23.567, longitude: -46.662, avaliacao: 4.9, ativo: true },
        { id: 3, usuarioId: 8, nomeLocal: "Espaço Equilíbrio", logradouro: "Rua das Palmeiras", numero: "45", bairro: "Vila Nova", cidade: "São Paulo", uf: "SP", latitude: -23.575, longitude: -46.64, avaliacao: 4.7, ativo: true },
        { id: 4, usuarioId: 9, nomeLocal: "Clínica Viva Bem", logradouro: "Rua XV de Novembro", numero: "300", bairro: "Centro", cidade: "São Paulo", uf: "SP", latitude: -23.55, longitude: -46.633, avaliacao: 5.0, ativo: true }
    ];

    servicos = [
        { id: 1, profissionalId: 1, nome: "Corte de cabelo", categoria: "Barbearia", descricao: "Corte masculino com acabamento na navalha.", duracaoMin: 45, preco: 45, ativo: true },
        { id: 2, profissionalId: 1, nome: "Barba", categoria: "Barbearia", descricao: "Barba modelada com toalha quente.", duracaoMin: 30, preco: 30, ativo: true },
        { id: 3, profissionalId: 2, nome: "Manicure e pedicure", categoria: "Beleza", descricao: "Cuidado completo para mãos e pés.", duracaoMin: 90, preco: 70, ativo: true },
        { id: 4, profissionalId: 3, nome: "Massagem relaxante", categoria: "Bem-estar", descricao: "Sessão de 60 minutos para aliviar tensões.", duracaoMin: 60, preco: 120, ativo: true },
        { id: 5, profissionalId: 2, nome: "Limpeza de pele", categoria: "Beleza", descricao: "Limpeza profunda com hidratação.", duracaoMin: 60, preco: 95, ativo: true },
        { id: 6, profissionalId: 4, nome: "Consulta de nutrição", categoria: "Saúde", descricao: "Avaliação e plano alimentar personalizado.", duracaoMin: 50, preco: 150, ativo: true },
        { id: 7, profissionalId: 3, nome: "Limpeza de pele", categoria: "Beleza", descricao: "Limpeza profunda com hidratação.", duracaoMin: 60, preco: 95, ativo: true }
    ];

    // Agenda semanal: dia 0 = domingo ... 6 = sábado; cada item é o início de um horário de uma hora
    const semana = [
        [1, [1, 2, 3, 4, 5], horas(9, 10, 11, 13, 14, 15, 16)],
        [1, [6], horas(9, 10, 11, 12)],
        [2, [2, 3, 4, 5], horas(9, 11, 14, 16)],
        [2, [6], horas(9, 11, 13)],
        [3, [1, 3, 5], horas(10, 11, 15, 16, 17)],
        [4, [2, 4], horas(8, 9, 10, 14, 15)]
    ];
    disponibilidadeSemanal = [];
    for (const [profissionalId, dias, hs] of semana) {
        for (const diaSemana of dias) for (const horaInicio of hs) disponibilidadeSemanal.push({ profissionalId, diaSemana, horaInicio });
    }

    bloqueios = [{ profissionalId: 1, data: dataRelativa(2), hora: "14:00" }];

    // status em MAIÚSCULAS (formato do front-end); o banco guarda em minúsculas
    const ag = (usuarioId, servicoId, profissionalId, dias, hora, status) => ({ usuarioId, servicoId, profissionalId, data: dataRelativa(dias), hora, status });
    agendamentos = [
        ag(1, 1, 1, 1, "10:00", "CONFIRMADO"), ag(1, 3, 2, 3, "14:00", "PENDENTE"), ag(1, 2, 1, -7, "11:00", "CONCLUIDO"),
        ag(1, 4, 3, -14, "15:00", "CANCELADO"), ag(2, 1, 1, 1, "13:00", "PENDENTE"), ag(3, 6, 4, 2, "09:00", "CONFIRMADO"),
        ag(2, 5, 2, -3, "09:00", "CONCLUIDO"), ag(3, 4, 3, 4, "16:00", "PENDENTE"),
        ag(4, 1, 1, 0, "09:00", "CONCLUIDO"), ag(2, 2, 1, 0, "10:00", "CONFIRMADO"), ag(5, 1, 1, 0, "11:00", "PENDENTE"),
        ag(3, 1, 1, 0, "14:00", "CONFIRMADO"), ag(1, 2, 1, 0, "16:00", "CANCELADO")
    ].map((a, i) => ({ id: i + 1, ...a }));

    return { usuarios, profissionais, servicos, disponibilidadeSemanal, bloqueios, agendamentos };
}

module.exports = { gerar };
