const agendamentos = require("../services/agendamentos.service");

exports.listar = async (req, res) => res.json(await agendamentos.listar(req.usuario, req.query));
exports.criar = async (req, res) => res.status(201).json(await agendamentos.criar(req.usuario, req.body || {}));
exports.alterarStatus = async (req, res) => res.json(await agendamentos.alterarStatus(req.usuario, req.params.id, (req.body || {}).status));
exports.reagendar = async (req, res) => res.json(await agendamentos.reagendar(req.usuario, req.params.id, req.body || {}));
exports.excluir = async (req, res) => { await agendamentos.excluir(req.usuario, req.params.id); res.status(204).end(); };
