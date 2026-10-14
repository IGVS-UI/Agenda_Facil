/*
 * Monta o aplicativo Express (sem iniciar o servidor: isso é do server.js, o que facilita os testes).
 */
const express = require("express");
const cors = require("cors");
const config = require("./config/env");
const rotas = require("./routes");
const { rotaNaoEncontrada, tratarErros } = require("./middlewares/erros");

const app = express();

app.use(cors({ origin: config.corsOrigem === "*" ? true : config.corsOrigem.split(",") }));
app.use(express.json());

app.use("/api", rotas);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;
