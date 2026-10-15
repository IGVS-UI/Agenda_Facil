-- =====================================================================
-- Agenda Fácil — apaga UMA conta do sistema pelo e-mail
--
-- Apagar o usuário no console do Firebase remove só o login (e-mail e senha). O cadastro
-- (perfil cliente/profissional, agendamentos, local, serviços, agenda) continua aqui no MySQL,
-- e o sistema religa esse cadastro quando o login é criado de novo com o mesmo e-mail.
-- Para apagar a conta de verdade, faça os DOIS passos:
--   1. rode este script (troque o e-mail logo abaixo);
--   2. no console do Firebase: Authentication > Users > apague o usuário com esse e-mail.
--
-- ATENÇÃO: não tem volta. Some também:
--   - os agendamentos que essa pessoa fez como cliente;
--   - se for profissional: o local, os serviços, a agenda, os bloqueios e TODOS os agendamentos
--     que os clientes fizeram com ela.
-- Faça um backup antes (Server > Data Export). Execute tudo de uma vez no Workbench (raio sem cursor).
-- =====================================================================

USE Agenda_Facil;

SET @email = 'coloque-o-email-aqui@gmail.com';   -- <<< troque pelo e-mail da conta

SET @safe_updates_anterior = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

-- O que vai ser apagado (confira o resultado antes de seguir)
SELECT id_usuario, nome, email, tipo FROM usuario WHERE email = @email;

START TRANSACTION;

CREATE TEMPORARY TABLE conta_usuarios AS
    SELECT id_usuario FROM usuario WHERE email = @email;
CREATE TEMPORARY TABLE conta_profissionais AS
    SELECT id_profissional FROM profissional WHERE usuario_id IN (SELECT id_usuario FROM conta_usuarios);

-- Agendamentos ligados à conta (como cliente ou como profissional)
DELETE FROM agendamento
WHERE usuario_id IN (SELECT id_usuario FROM conta_usuarios)
   OR profissional_id IN (SELECT id_profissional FROM conta_profissionais);

DELETE FROM bloqueio                WHERE profissional_id IN (SELECT id_profissional FROM conta_profissionais);
DELETE FROM disponibilidade_semanal WHERE profissional_id IN (SELECT id_profissional FROM conta_profissionais);
DELETE FROM servico                 WHERE profissional_id IN (SELECT id_profissional FROM conta_profissionais);
DELETE FROM profissional            WHERE id_profissional IN (SELECT id_profissional FROM conta_profissionais);
DELETE FROM usuario                 WHERE id_usuario IN (SELECT id_usuario FROM conta_usuarios);

COMMIT;

DROP TEMPORARY TABLE conta_profissionais;
DROP TEMPORARY TABLE conta_usuarios;

SET SQL_SAFE_UPDATES = @safe_updates_anterior;

-- Conferência: não deve aparecer mais nenhuma linha com esse e-mail
SELECT id_usuario, nome, email, tipo FROM usuario WHERE email = @email;
