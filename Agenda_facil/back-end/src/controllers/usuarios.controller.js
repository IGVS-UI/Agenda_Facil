// GET /api/me: quem está logado e com qual perfil (o front usa para escolher a página certa)
exports.eu = (req, res) => res.json(req.usuario);
