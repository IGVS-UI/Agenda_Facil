const profissionais = require("../services/profissionais.service");
const horarios = require("../services/horarios.service");
const disponibilidade = require("../services/disponibilidade.service");

exports.listar = async (req, res) => res.json(await profissionais.listar(req.query));
exports.listarOrigens = (req, res) => res.json(profissionais.listarOrigens());
exports.horariosDisponiveis = async (req, res) => res.json(await horarios.listar(req.query));
exports.obterDisponibilidade = async (req, res) => res.json(await disponibilidade.obter(req.usuario, req.params.id));
exports.salvarDisponibilidade = async (req, res) => res.json(await disponibilidade.salvar(req.usuario, req.params.id, req.body || {}));
