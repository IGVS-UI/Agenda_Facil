-- =====================================================================
-- Agenda Fácil — criação do banco de dados do zero (MySQL 8.0)
--
-- Use este script quando o banco AINDA NÃO EXISTE (só o modelo .mwb).
-- Ele cria o banco já no formato final (agenda semanal + bloqueios, login pelo Firebase).
--
-- Execute uma vez, no MySQL Workbench (conectado ao servidor):
--   File > Open SQL Script > escolher este arquivo > raio amarelo (executar tudo).
--
-- Tabelas: usuario, profissional, servico, disponibilidade_semanal, bloqueio, agendamento
-- =====================================================================

CREATE DATABASE IF NOT EXISTS Agenda_Facil
    CHARACTER SET utf8mb4;

USE Agenda_Facil;

-- ---------------------------------------------------------------------
-- usuario: clientes e profissionais.
-- A senha fica no Firebase Authentication; aqui só o vínculo (firebase_uid).
-- firebase_uid e senha_hash aceitam NULL (contas de teste/antigas); a API sempre preenche
-- o firebase_uid nas contas novas. O UNIQUE aceita vários NULL.
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
    id_usuario   INT          NOT NULL AUTO_INCREMENT,
    firebase_uid VARCHAR(128) NULL,
    nome         VARCHAR(100) NOT NULL,
    email        VARCHAR(150) NOT NULL,
    telefone     VARCHAR(20)  NULL,
    senha_hash   VARCHAR(255) NULL,
    tipo         ENUM('cliente', 'profissional') NOT NULL DEFAULT 'cliente',
    ativo        TINYINT      NOT NULL DEFAULT 1,
    criado_em    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario),
    UNIQUE KEY email_UNIQUE (email),
    UNIQUE KEY firebase_uid_UNIQUE (firebase_uid)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- profissional: dados do profissional e do local de atendimento.
-- latitude/longitude são preenchidas pela API a partir do endereço (busca por proximidade).
-- ---------------------------------------------------------------------
CREATE TABLE profissional (
    id_profissional INT          NOT NULL AUTO_INCREMENT,
    usuario_id      INT          NOT NULL,
    nome_local      VARCHAR(120) NULL,
    especialidade   VARCHAR(100) NOT NULL,
    biografia       VARCHAR(250) NULL,
    celular         VARCHAR(20)  NOT NULL,
    cep             CHAR(8)      NULL,
    logradouro      VARCHAR(150) NULL,
    numero          VARCHAR(10)  NULL,
    complemento     VARCHAR(80)  NULL,
    bairro          VARCHAR(80)  NULL,
    cidade          VARCHAR(80)  NULL,
    uf              CHAR(2)      NULL,
    latitude        DECIMAL(9,6) NULL,
    longitude       DECIMAL(9,6) NULL,
    ativo           TINYINT      NOT NULL DEFAULT 1,
    PRIMARY KEY (id_profissional),
    UNIQUE KEY usuario_id_UNIQUE (usuario_id),
    INDEX idx_profissional_localizacao (latitude, longitude),
    CONSTRAINT fk_profissional_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id_usuario),
    CONSTRAINT chk_profissional_latitude  CHECK (latitude  IS NULL OR latitude  BETWEEN  -90 AND  90),
    CONSTRAINT chk_profissional_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- servico: serviços de cada profissional.
-- UNIQUE (id_servico, profissional_id) permite ao agendamento apontar para o par
-- "serviço + profissional", garantindo que combinam.
-- ---------------------------------------------------------------------
CREATE TABLE servico (
    id_servico      INT           NOT NULL AUTO_INCREMENT,
    profissional_id INT           NOT NULL,
    nome            VARCHAR(100)  NOT NULL,
    categoria       VARCHAR(50)   NOT NULL DEFAULT 'Outros',
    descricao       VARCHAR(255)  NOT NULL,
    duracao_minutos SMALLINT      NOT NULL,
    preco           DECIMAL(10,2) NOT NULL,
    ativo           TINYINT       NOT NULL DEFAULT 1,
    PRIMARY KEY (id_servico),
    UNIQUE KEY uq_servico_profissional (id_servico, profissional_id),
    INDEX fk_servico_profissional_idx (profissional_id),
    CONSTRAINT fk_servico_profissional FOREIGN KEY (profissional_id) REFERENCES profissional (id_profissional)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Agenda semanal.
-- disponibilidade_semanal: horários de atendimento que se repetem toda semana.
--   dia_semana: 0 = domingo ... 6 = sábado (igual ao JavaScript, usado no front-end).
--   Cada linha é um horário de uma hora (ex.: segunda 09:00-10:00).
-- bloqueio: horário específico em que o profissional NÃO atende (folga, consulta, imprevisto).
--   Um dia inteiro é representado por um bloqueio para cada horário daquele dia.
-- ---------------------------------------------------------------------
CREATE TABLE disponibilidade_semanal (
    id_disponibilidade_semanal INT     NOT NULL AUTO_INCREMENT,
    profissional_id            INT     NOT NULL,
    dia_semana                 TINYINT NOT NULL,
    hora_inicio                TIME    NOT NULL,
    hora_fim                   TIME    NOT NULL,
    PRIMARY KEY (id_disponibilidade_semanal),
    UNIQUE KEY uq_disp_semanal (profissional_id, dia_semana, hora_inicio),
    CONSTRAINT fk_disp_semanal_profissional FOREIGN KEY (profissional_id) REFERENCES profissional (id_profissional),
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
    CONSTRAINT fk_bloqueio_profissional FOREIGN KEY (profissional_id) REFERENCES profissional (id_profissional)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- agendamento: cliente (usuario_id) + serviço + profissional + data + hora.
-- horario_ocupado: coluna calculada, vale 1 enquanto o agendamento ocupa o horário
--   (pendente ou confirmado) e NULL nos demais (concluído ou cancelado). Como NULL nunca
--   conflita no UNIQUE, o banco impede dois agendamentos ATIVOS no mesmo horário do mesmo
--   profissional e libera o horário assim que o agendamento é cancelado.
-- A chave composta (servico_id, profissional_id) garante que o serviço é do profissional.
-- ---------------------------------------------------------------------
CREATE TABLE agendamento (
    id_agendamento   INT  NOT NULL AUTO_INCREMENT,
    usuario_id       INT  NOT NULL,
    servico_id       INT  NOT NULL,
    profissional_id  INT  NOT NULL,
    data_agendamento DATE NOT NULL,
    hora_inicio      TIME NOT NULL,
    status           ENUM('pendente', 'confirmado', 'concluido', 'cancelado') NOT NULL DEFAULT 'pendente',
    observacoes      VARCHAR(255) NULL,
    criado_em        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    horario_ocupado  TINYINT GENERATED ALWAYS AS
                     (CASE WHEN status IN ('pendente', 'confirmado') THEN 1 ELSE NULL END) STORED,
    PRIMARY KEY (id_agendamento),
    UNIQUE KEY uq_agendamento_horario_ativo (profissional_id, data_agendamento, hora_inicio, horario_ocupado),
    INDEX fk_agendamento_usuario_idx (usuario_id),
    INDEX fk_agendamento_servico_idx (servico_id),
    INDEX idx_agendamento_cliente_data      (usuario_id, data_agendamento),
    INDEX idx_agendamento_profissional_data (profissional_id, data_agendamento),
    CONSTRAINT fk_agendamento_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id_usuario),
    CONSTRAINT fk_agendamento_servico FOREIGN KEY (servico_id) REFERENCES servico (id_servico),
    CONSTRAINT fk_agendamento_profissional FOREIGN KEY (profissional_id) REFERENCES profissional (id_profissional),
    CONSTRAINT fk_agendamento_servico_profissional FOREIGN KEY (servico_id, profissional_id)
        REFERENCES servico (id_servico, profissional_id)
) ENGINE = InnoDB;
