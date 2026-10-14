// Controladores: só traduzem HTTP <-> serviço (leem a requisição, chamam a regra, devolvem JSON).
const servicos = require("../services/servicos.service");

exports.listar = async (req, res) => res.json(await servicos.listar(req.usuario, req.query));
exports.criar = async (req, res) => res.status(201).json(await servicos.criar(req.usuario, req.body || {}));
exports.atualizar = async (req, res) => res.json(await servicos.atualizar(req.usuario, req.params.id, req.body || {}));
