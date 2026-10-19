-- =====================================================================
-- Agenda Fácil — remove os DADOS DE EXEMPLO (opcional)
--
-- Apaga só o que veio do dados_exemplo.sql: as contas com e-mail terminando em "@exemplo.com"
-- (João, Marina, Igor Silva...) e tudo ligado a elas (serviços, agenda, bloqueios e agendamentos).
-- As contas criadas de verdade pelo sistema (login do Firebase) NÃO são tocadas.
--
-- Use antes de apresentar, para que só apareçam os profissionais cadastrados de verdade.
-- Faça um backup antes (Server > Data Export). Execute tudo de uma vez no Workbench.
-- =====================================================================

USE Agenda_Facil;

SET @safe_updates_anterior = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

-- Contas de exemplo
CREATE TEMPORARY TABLE exemplo_usuarios AS
    SELECT id_usuario FROM usuario WHERE email LIKE '%@exemplo.com';
CREATE TEMPORARY TABLE exemplo_profissionais AS
    SELECT id_profissional FROM profissional WHERE usuario_id IN (SELECT id_usuario FROM exemplo_usuarios);

-- Agendamentos ligados a elas (como cliente ou como profissional)
DELETE FROM agendamento
WHERE usuario_id IN (SELECT id_usuario FROM exemplo_usuarios)
   OR profissional_id IN (SELECT id_profissional FROM exemplo_profissionais);

DELETE FROM bloqueio                WHERE profissional_id IN (SELECT id_profissional FROM exemplo_profissionais);
DELETE FROM disponibilidade_semanal WHERE profissional_id IN (SELECT id_profissional FROM exemplo_profissionais);
DELETE FROM servico                 WHERE profissional_id IN (SELECT id_profissional FROM exemplo_profissionais);
DELETE FROM profissional            WHERE id_profissional IN (SELECT id_profissional FROM exemplo_profissionais);
DELETE FROM usuario                 WHERE id_usuario IN (SELECT id_usuario FROM exemplo_usuarios);

DROP TEMPORARY TABLE exemplo_profissionais;
DROP TEMPORARY TABLE exemplo_usuarios;

SET SQL_SAFE_UPDATES = @safe_updates_anterior;

-- Conferência: deve sobrar só o que foi cadastrado pelo sistema
SELECT id_usuario, nome, email, tipo FROM usuario ORDER BY id_usuario;
