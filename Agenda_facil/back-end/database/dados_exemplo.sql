-- =====================================================================
-- Agenda Fácil — dados de exemplo (OPCIONAL, só para desenvolvimento e testes)
--
-- Rode DEPOIS do criar_banco.sql, num banco vazio ou de testes. Não use em produção.
-- Espelha os dados de exemplo do front-end: 5 clientes, 4 profissionais, 7 serviços,
-- agenda semanal, 1 bloqueio e 13 agendamentos nos 4 status (datas relativas a hoje).
-- Os usuários não têm firebase_uid nem senha: servem só para a API ler e testar.
-- Os endereços e as coordenadas são FICTÍCIOS (região da Av. Paulista, São Paulo).
-- =====================================================================

USE Agenda_Facil;

-- Clientes (1 a 5) e profissionais (6 a 9)
INSERT INTO usuario (id_usuario, nome, email, telefone, tipo) VALUES
 (1, 'Igor Silva',    'igor@exemplo.com',   '(11) 91234-5678', 'cliente'),
 (2, 'Ana Souza',     'ana@exemplo.com',    '(11) 98765-4321', 'cliente'),
 (3, 'Pedro Lima',    'pedro@exemplo.com',  '(11) 97777-1212', 'cliente'),
 (4, 'Carlos Mendes', 'carlos@exemplo.com', '(11) 96666-3434', 'cliente'),
 (5, 'Julia Prado',   'julia@exemplo.com',  '(11) 95555-7878', 'cliente'),
 (6, 'João Barbosa',  'joao@exemplo.com',   '(11) 94444-0001', 'profissional'),
 (7, 'Marina Alves',  'marina@exemplo.com', '(11) 94444-0002', 'profissional'),
 (8, 'Carla Mendes',  'carla@exemplo.com',  '(11) 94444-0003', 'profissional'),
 (9, 'Rafael Costa',  'rafael@exemplo.com', '(11) 94444-0004', 'profissional');

INSERT INTO profissional
 (id_profissional, usuario_id, nome_local, especialidade, biografia, celular,
  cep, logradouro, numero, bairro, cidade, uf, latitude, longitude) VALUES
 (1, 6, 'Barbearia do João',    'Barbearia',   'Cortes clássicos e barba na navalha.',        '(11) 94444-0001', '01310100', 'Rua das Flores',        '120', 'Centro',          'São Paulo', 'SP', -23.561700, -46.655900),
 (2, 7, 'Studio Marina Alves',  'Beleza',      'Manicure, pedicure e cuidados com a pele.',   '(11) 94444-0002', '01310200', 'Av. Brasil',            '850', 'Jardim América',  'São Paulo', 'SP', -23.567000, -46.662000),
 (3, 8, 'Espaço Equilíbrio',    'Bem-estar',   'Massagem relaxante e terapias corporais.',    '(11) 94444-0003', '01310300', 'Rua das Palmeiras',     '45',  'Vila Nova',       'São Paulo', 'SP', -23.575000, -46.640000),
 (4, 9, 'Clínica Viva Bem',     'Nutrição',    'Acompanhamento nutricional personalizado.',   '(11) 94444-0004', '01310400', 'Rua XV de Novembro',    '300', 'Centro',          'São Paulo', 'SP', -23.550000, -46.633000);

INSERT INTO servico (id_servico, profissional_id, nome, categoria, descricao, duracao_minutos, preco) VALUES
 (1, 1, 'Corte de cabelo',       'Barbearia', 'Corte masculino com acabamento na navalha.', 45,  45.00),
 (2, 1, 'Barba',                 'Barbearia', 'Barba modelada com toalha quente.',          30,  30.00),
 (3, 2, 'Manicure e pedicure',   'Beleza',    'Cuidado completo para mãos e pés.',          90,  70.00),
 (4, 3, 'Massagem relaxante',    'Bem-estar', 'Sessão de 60 minutos para aliviar tensões.', 60, 120.00),
 (5, 2, 'Limpeza de pele',       'Beleza',    'Limpeza profunda com hidratação.',           60,  95.00),
 (6, 4, 'Consulta de nutrição',  'Saúde',     'Avaliação e plano alimentar personalizado.', 50, 150.00),
 (7, 3, 'Limpeza de pele',       'Beleza',    'Limpeza profunda com hidratação.',           60,  95.00);

-- Agenda semanal: cada linha é um horário de uma hora (dia_semana 0 = domingo ... 6 = sábado)
-- João: segunda a sexta 9, 10, 11, 13, 14, 15, 16h; sábado 9, 10, 11, 12h
INSERT INTO disponibilidade_semanal (profissional_id, dia_semana, hora_inicio, hora_fim)
SELECT 1, d.dia, MAKETIME(h.h, 0, 0), MAKETIME(h.h + 1, 0, 0)
FROM (SELECT 1 AS dia UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) d
CROSS JOIN (SELECT 9 AS h UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16) h;
INSERT INTO disponibilidade_semanal (profissional_id, dia_semana, hora_inicio, hora_fim)
SELECT 1, 6, MAKETIME(h.h, 0, 0), MAKETIME(h.h + 1, 0, 0)
FROM (SELECT 9 AS h UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12) h;

-- Marina: terça a sexta 9, 11, 14, 16h; sábado 9, 11, 13h
INSERT INTO disponibilidade_semanal (profissional_id, dia_semana, hora_inicio, hora_fim)
SELECT 2, d.dia, MAKETIME(h.h, 0, 0), MAKETIME(h.h + 1, 0, 0)
FROM (SELECT 2 AS dia UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) d
CROSS JOIN (SELECT 9 AS h UNION ALL SELECT 11 UNION ALL SELECT 14 UNION ALL SELECT 16) h;
INSERT INTO disponibilidade_semanal (profissional_id, dia_semana, hora_inicio, hora_fim)
SELECT 2, 6, MAKETIME(h.h, 0, 0), MAKETIME(h.h + 1, 0, 0)
FROM (SELECT 9 AS h UNION ALL SELECT 11 UNION ALL SELECT 13) h;

-- Carla: segunda, quarta e sexta 10, 11, 15, 16, 17h
INSERT INTO disponibilidade_semanal (profissional_id, dia_semana, hora_inicio, hora_fim)
SELECT 3, d.dia, MAKETIME(h.h, 0, 0), MAKETIME(h.h + 1, 0, 0)
FROM (SELECT 1 AS dia UNION ALL SELECT 3 UNION ALL SELECT 5) d
CROSS JOIN (SELECT 10 AS h UNION ALL SELECT 11 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17) h;

-- Rafael: terça e quinta 8, 9, 10, 14, 15h
INSERT INTO disponibilidade_semanal (profissional_id, dia_semana, hora_inicio, hora_fim)
SELECT 4, d.dia, MAKETIME(h.h, 0, 0), MAKETIME(h.h + 1, 0, 0)
FROM (SELECT 2 AS dia UNION ALL SELECT 4) d
CROSS JOIN (SELECT 8 AS h UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 14 UNION ALL SELECT 15) h;

-- Um bloqueio: João não atende às 14h, daqui a 2 dias
INSERT INTO bloqueio (profissional_id, data_bloqueio, hora_inicio)
VALUES (1, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '14:00:00');

-- Agendamentos (usuario_id = cliente). Datas relativas a hoje; status nos 4 valores.
INSERT INTO agendamento (usuario_id, servico_id, profissional_id, data_agendamento, hora_inicio, status) VALUES
 (1, 1, 1, DATE_ADD(CURDATE(), INTERVAL  1 DAY), '10:00:00', 'confirmado'),
 (1, 3, 2, DATE_ADD(CURDATE(), INTERVAL  3 DAY), '14:00:00', 'pendente'),
 (1, 2, 1, DATE_SUB(CURDATE(), INTERVAL  7 DAY), '11:00:00', 'concluido'),
 (1, 4, 3, DATE_SUB(CURDATE(), INTERVAL 14 DAY), '15:00:00', 'cancelado'),
 (2, 1, 1, DATE_ADD(CURDATE(), INTERVAL  1 DAY), '13:00:00', 'pendente'),
 (3, 6, 4, DATE_ADD(CURDATE(), INTERVAL  2 DAY), '09:00:00', 'confirmado'),
 (2, 5, 2, DATE_SUB(CURDATE(), INTERVAL  3 DAY), '09:00:00', 'concluido'),
 (3, 4, 3, DATE_ADD(CURDATE(), INTERVAL  4 DAY), '16:00:00', 'pendente'),
 -- Agenda de hoje do João
 (4, 1, 1, CURDATE(), '09:00:00', 'concluido'),
 (2, 2, 1, CURDATE(), '10:00:00', 'confirmado'),
 (5, 1, 1, CURDATE(), '11:00:00', 'pendente'),
 (3, 1, 1, CURDATE(), '14:00:00', 'confirmado'),
 (1, 2, 1, CURDATE(), '16:00:00', 'cancelado');
