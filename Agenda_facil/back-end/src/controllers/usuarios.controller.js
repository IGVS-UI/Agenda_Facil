const usuarios = require("../services/usuarios.service");

// GET /api/me: quem está logado e com qual perfil (o front usa para escolher a página certa)
exports.eu = (req, res) => res.json(req.usuario);

// POST /api/usuarios: conclui o cadastro de quem já existe no Firebase (token válido, ainda sem conta no sistema)
exports.cadastrar = async (req, res) => {
    if (req.usuario) return res.status(409).json({ mensagem: "Esta conta já está cadastrada. Entre para continuar." });
    res.status(201).json(await usuarios.criar(req.tokenInfo, req.body || {}));
};
