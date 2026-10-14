-- =====================================================================
-- Agenda Fácil — ajustes do banco de dados (MySQL 8.0)
--
-- Leva o modelo atual (agenda_facil.mwb) ao modelo que o front-end e a API precisam.
-- Execute UMA vez, na ordem, no MySQL Workbench (File > Open SQL Script > Executar tudo).
-- FAÇA UM BACKUP ANTES (Server > Data Export). Os comandos de estrutura (ALTER/CREATE)
-- não têm "desfazer".
--
-- O que muda:
--   1. usuario       : firebase_uid (login pelo Firebase), telefone; senha_hash passa a ser opcional
--   2. profissional  : nome do local, endereço completo e latitude/longitude
--   3. servico       : categoria
--   4. agenda semanal: disponibilidade_semanal (dias/horários) e bloqueio (folgas e imprevistos)
--   5. agendamento   : guarda profissional, data e hora; impede horário duplicado entre os
--                      agendamentos ativos; garante que o serviço é do profissional escolhido
--
-- A tabela antiga "disponibilidade" (um horário por data) NÃO é apagada: veja a seção 6.
-- =====================================================================

USE Agenda_Facil;

-- ---------------------------------------------------------------------
-- 1. usuario
--    O Firebase Authentication guarda a senha. O MySQL guarda só o vínculo (firebase_uid).
--    NULL é permitido porque usuários antigos ainda não têm firebase_uid; a API sempre
--    preenche para contas novas. O UNIQUE aceita vários NULL.
-- ---------------------------------------------------------------------
ALTER TABLE usuario
    ADD COLUMN firebase_uid VARCHAR(128) NULL AFTER id_usuario,
    ADD COLUMN telefone     VARCHAR(20)  NULL AFTER email,
    MODIFY COLUMN senha_hash VARCHAR(255) NULL,
    ADD UNIQUE KEY firebase_uid_UNIQUE (firebase_uid);

-- ---------------------------------------------------------------------
-- 2. profissional: local de atendimento e localização
--    Colunas NULL para não quebrar linhas antigas; a API exige o preenchimento no cadastro.
--    latitude/longitude são preenchidas pela API a partir do endereço (busca por proximidade).
-- ---------------------------------------------------------------------
ALTER TABLE profissional
    ADD COLUMN nome_local  VARCHAR(120)  NULL AFTER usuario_id,
    ADD COLUMN cep         CHAR(8)       NULL,
    ADD COLUMN logradouro  VARCHAR(150)  NULL,
    ADD COLUMN numero      VARCHAR(10)   NULL,
    ADD COLUMN complemento VARCHAR(80)   NULL,
    ADD COLUMN bairro      VARCHAR(80)   NULL,
    ADD COLUMN cidade      VARCHAR(80)   NULL,
    ADD COLUMN uf          CHAR(2)       NULL,
    ADD COLUMN latitude    DECIMAL(9,6)  NULL,
    ADD COLUMN longitude   DECIMAL(9,6)  NULL,
    ADD INDEX idx_profissional_localizacao (latitude, longitude),
    ADD CONSTRAINT chk_profissional_latitude  CHECK (latitude  IS NULL OR latitude  BETWEEN  -90 AND  90),
    ADD CONSTRAINT chk_profissional_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

-- ---------------------------------------------------------------------
-- 3. servico: categoria
--    UNIQUE (id_servico, profissional_id) permite que o agendamento aponte para o par
--    "serviço + profissional" e o banco garanta que combinam (seção 5).
-- ---------------------------------------------------------------------
ALTER TABLE servico
    ADD COLUMN categoria VARCHAR(50) NOT NULL DEFAULT 'Outros' AFTER nome,
    ADD UNIQUE KEY uq_servico_profissional (id_servico, profissional_id);

-- ---------------------------------------------------------------------
-- 4. Agenda semanal
--    disponibilidade_semanal: cada linha é um horário de atendimento que se repete toda semana.
--      dia_semana: 0 = domingo ... 6 = sábado (igual ao JavaScript, usado no front-end).
--      Ex.: segunda 09:00-10:00, segunda 10:00-11:00, ...
--    bloqueio: horário específico em que o profissional NÃO atende (folga, consulta, imprevisto).
--      Um dia inteiro é representado por um bloqueio para cada horário daquele dia.
-- ---------------------------------------------------------------------
CREATE TABLE disponibilidade_semanal (
    id_disponibilidade_semanal INT      NOT NULL AUTO_INCREMENT,
    profissional_id            INT      NOT NULL,
    dia_semana                 TINYINT  NOT NULL,
    hora_inicio                TIME     NOT NULL,
    hora_fim                   TIME     NOT NULL,
    PRIMARY KEY (id_disponibilidade_semanal),
    UNIQUE KEY uq_disp_semanal (profissional_id, dia_semana, hora_inicio),
    CONSTRAINT fk_disp_semanal_profissional FOREIGN KEY (profissional_id)
        REFERENCES profissional (id_profissional),
    CONSTRAINT chk_disp_semanal_dia  CHECK (dia_semana BETWEEN 0 AND 6),
    CONSTRAINT chk_disp_semanal_hora CHECK (hora_fim > hora_inicio)
) ENGINE = InnoDB;

CREATE TABLE bloqueio (
    id_bloqueio     INT  NOT NULL AUTO_INCREMENT,
    profissional_id INT  NOT NULL,
    data_bloqueio   DATE NOT NULL,
    hora_inicio     TIME NOT NULL,
    PRIMARY KEY (id_bloqueio),
    UNIQUE KEY uq_bloqueio (profissional_id, data_bloqueio, hora_inicio),
    CONSTRAINT fk_bloqueio_profissional FOREIGN KEY (profissional_id)
        REFERENCES profissional (id_profissional)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 5. agendamento
--    Antes: o horário vinha de "disponibilidade" (disponibilidade_id, único).
--    Agora: o agendamento guarda profissional + data + hora. Os dados antigos são copiados.
-- ---------------------------------------------------------------------
ALTER TABLE agendamento
    ADD COLUMN profissional_id   INT  NULL AFTER servico_id,
    ADD COLUMN data_agendamento  DATE NULL AFTER profissional_id,
    ADD COLUMN hora_inicio       TIME NULL AFTER data_agendamento;

-- Copia os dados dos agendamentos existentes (profissional pelo serviço; data/hora pela disponibilidade)
-- O Workbench vem com "Safe Updates" ligado, que bloqueia UPDATE sem WHERE (erro 1175).
-- Desligamos só para este comando e voltamos ao valor anterior em seguida.
SET @safe_updates_anterior = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;
UPDATE agendamento a
    JOIN servico s         ON s.id_servico = a.servico_id
    JOIN disponibilidade d ON d.id_disponibilidade = a.disponibilidade_id
SET a.profissional_id  = s.profissional_id,
    a.data_agendamento = d.data_disponivel,
    a.hora_inicio      = d.hora_inicio;
SET SQL_SAFE_UPDATES = @safe_updates_anterior;

ALTER TABLE agendamento
    MODIFY COLUMN profissional_id  INT  NOT NULL,
    MODIFY COLUMN data_agendamento DATE NOT NULL,
    MODIFY COLUMN hora_inicio      TIME NOT NULL;

-- A ligação antiga deixa de ser obrigatória (e deixa de ser única: ela travava o reagendamento
-- de um horário cujo agendamento foi cancelado).
ALTER TABLE agendamento DROP FOREIGN KEY fk_agendamento_disponibilidade;
ALTER TABLE agendamento DROP INDEX disponibilidade_id_UNIQUE;
ALTER TABLE agendamento MODIFY COLUMN disponibilidade_id INT NULL;

-- Coluna calculada: vale 1 enquanto o agendamento ocupa o horário (pendente ou confirmado)
-- e NULL nos demais (concluído ou cancelado). O UNIQUE abaixo, como NULL nunca conflita,
-- impede dois agendamentos ATIVOS no mesmo horário do mesmo profissional, e libera o horário
-- assim que o agendamento é cancelado. É a "trava" final contra conflito, no próprio banco.
ALTER TABLE agendamento
    ADD COLUMN horario_ocupado TINYINT
        GENERATED ALWAYS AS (CASE WHEN status IN ('pendente', 'confirmado') THEN 1 ELSE NULL END) STORED,
    ADD UNIQUE KEY uq_agendamento_horario_ativo (profissional_id, data_agendamento, hora_inicio, horario_ocupado),
    ADD INDEX idx_agendamento_cliente_data      (usuario_id, data_agendamento),
    ADD INDEX idx_agendamento_profissional_data (profissional_id, data_agendamento);

-- O serviço precisa ser do profissional do agendamento (chave composta com servico).
ALTER TABLE agendamento
    ADD CONSTRAINT fk_agendamento_servico_profissional FOREIGN KEY (servico_id, profissional_id)
        REFERENCES servico (id_servico, profissional_id),
    ADD CONSTRAINT fk_agendamento_profissional FOREIGN KEY (profissional_id)
        REFERENCES profissional (id_profissional);

-- ---------------------------------------------------------------------
-- 6. Limpeza (OPCIONAL — só depois de conferir que está tudo certo)
--    A tabela "disponibilidade" e a coluna agendamento.disponibilidade_id não são mais usadas.
--    Remova quando quiser; está comentado de propósito.
-- ---------------------------------------------------------------------
-- ALTER TABLE agendamento DROP COLUMN disponibilidade_id;
-- DROP TABLE disponibilidade;
