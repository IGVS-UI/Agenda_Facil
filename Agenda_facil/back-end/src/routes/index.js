/*
 * Todas as rotas da API, em um só lugar (prefixo /api).
 *
 * Legenda de acesso:  público = qualquer um | logado = qualquer perfil | cliente / profissional = só o perfil
 */
const { Router } = require("express");
const { autenticar, autenticarToken, autenticarOpcional, exigirPerfil } = require("../middlewares/autenticacao");
const servicos = require("../controllers/servicos.controller");
const profissionais = require("../controllers/profissionais.controller");
const agendamentos = require("../controllers/agendamentos.controller");
const usuarios = require("../controllers/usuarios.controller");

const rotas = Router();
const cliente = exigirPerfil("cliente");
const profissional = exigirPerfil("profissional");

rotas.get("/saude", (req, res) => res.json({ ok: true }));

// Quem sou eu                                                         logado
rotas.get("/me", autenticar, usuarios.eu);                             // 403 CADASTRO_INCOMPLETO: tem token, mas ainda sem cadastro

// Cadastro (cria a conta no sistema)                                  token do Firebase, sem cadastro ainda
rotas.post("/usuarios", autenticarToken, usuarios.cadastrar);

// Catálogo                                                            público
rotas.get("/servicos", autenticarOpcional, servicos.listar);           // (desativados: só o dono)
rotas.get("/profissionais", profissionais.listar);
rotas.get("/origens", profissionais.listarOrigens);                    // localizações de exemplo (testes sem GPS)
rotas.get("/localizacao", profissionais.localizacaoDoCep);             // ?cep= -> latitude/longitude aproximadas
rotas.get("/horarios-disponiveis", profissionais.horariosDisponiveis);

// Serviços do profissional                                            profissional
rotas.post("/servicos", autenticar, profissional, servicos.criar);
rotas.put("/servicos/:id", autenticar, profissional, servicos.atualizar);
rotas.delete("/servicos/:id", autenticar, profissional, servicos.excluir);         // só serviço sem agendamentos

// Agenda do profissional                                              profissional
rotas.get("/profissionais/:id/disponibilidade", autenticar, profissional, profissionais.obterDisponibilidade);
rotas.put("/profissionais/:id/disponibilidade", autenticar, profissional, profissionais.salvarDisponibilidade);

// Agendamentos                                                        listar/status: logado; criar/reagendar/excluir: cliente
rotas.get("/agendamentos", autenticar, agendamentos.listar);                   // ?status= &data= ou &de= &ate=
rotas.post("/agendamentos", autenticar, cliente, agendamentos.criar);
rotas.put("/agendamentos/:id", autenticar, cliente, agendamentos.reagendar);
rotas.patch("/agendamentos/:id/status", autenticar, agendamentos.alterarStatus);
rotas.delete("/agendamentos/:id", autenticar, cliente, agendamentos.excluir);

module.exports = rotas;
