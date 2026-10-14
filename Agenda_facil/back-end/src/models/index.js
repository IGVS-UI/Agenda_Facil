/*
 * Escolhe de onde vêm os dados (DADOS_MODO no .env). Os serviços importam SEMPRE daqui:
 *   const modelo = require("../models");
 * Os dois modelos têm as mesmas funções: memoria.js (dados de exemplo) e mysql.js (banco).
 */
const { dadosModo } = require("../config/env");

if (dadosModo !== "memoria" && dadosModo !== "mysql") {
    throw new Error(`DADOS_MODO inválido: "${dadosModo}". Use "memoria" ou "mysql".`);
}

module.exports = dadosModo === "mysql" ? require("./mysql") : require("./memoria");
