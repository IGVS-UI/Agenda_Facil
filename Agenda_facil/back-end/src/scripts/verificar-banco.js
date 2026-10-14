/*
 * Verifica se o MySQL está pronto para a API:   npm run verificar
 * Usa as mesmas configurações do .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
 * Só LÊ o banco: não altera nada.
 */
const mysql = require("mysql2/promise");
const { bd } = require("../config/env");

const TABELAS = ["usuario", "profissional", "servico", "disponibilidade_semanal", "bloqueio", "agendamento"];
let problemas = 0;
const ok = (texto) => console.log(`  ✓ ${texto}`);
const falha = (texto, dica) => { problemas++; console.log(`  ✗ ${texto}${dica ? `\n      -> ${dica}` : ""}`); };

async function verificar() {
    console.log(`\nVerificando o banco "${bd.database}" em ${bd.host}:${bd.port} (usuário ${bd.user})\n`);

    let conexao;
    try {
        conexao = await mysql.createConnection({ host: bd.host, port: bd.port, user: bd.user, password: bd.password, database: bd.database });
        ok("Conexão com o MySQL");
    } catch (erro) {
        const dicas = {
            ECONNREFUSED: "O MySQL não está ligado ou a porta está errada (DB_PORT). Confira o serviço MySQL80 no Windows.",
            ER_ACCESS_DENIED_ERROR: "Usuário ou senha errados (DB_USER / DB_PASSWORD no .env).",
            ER_BAD_DB_ERROR: "O banco não existe. Rode o database/criar_banco.sql no Workbench (ou confira DB_NAME)."
        };
        falha(`Conexão com o MySQL: ${erro.message}`, dicas[erro.code]);
        return;
    }

    const [linhas] = await conexao.query("SHOW TABLES");
    const existentes = linhas.map((l) => Object.values(l)[0].toLowerCase());
    for (const tabela of TABELAS) {
        if (!existentes.includes(tabela)) { falha(`Tabela ${tabela}`, "Rode o database/criar_banco.sql."); continue; }
        const [[{ total }]] = await conexao.query(`SELECT COUNT(*) AS total FROM ${tabela}`);
        ok(`Tabela ${tabela.padEnd(24)} ${String(total).padStart(4)} linha(s)`);
    }

    // As travas mais importantes do banco
    const [indices] = await conexao.query("SHOW INDEX FROM agendamento WHERE Key_name = 'uq_agendamento_horario_ativo'").catch(() => [[]]);
    if (indices.length) ok("Trava contra horário duplicado (uq_agendamento_horario_ativo)");
    else falha("Trava contra horário duplicado", "A tabela agendamento parece estar no formato antigo: use o criar_banco.sql (ou o ajustes_banco.sql).");

    const [colunas] = await conexao.query("SHOW COLUMNS FROM usuario LIKE 'firebase_uid'").catch(() => [[]]);
    if (colunas.length) ok("Coluna usuario.firebase_uid (login pelo Firebase)");
    else falha("Coluna usuario.firebase_uid", "Rode o ajustes_banco.sql ou recrie o banco com o criar_banco.sql.");

    await conexao.end();
}

verificar()
    .catch((erro) => falha(`Erro inesperado: ${erro.message}`))
    .finally(() => {
        console.log(problemas ? `\n${problemas} problema(s) encontrado(s).\n` : "\nTudo certo: a API pode usar este banco (DADOS_MODO=mysql).\n");
        process.exitCode = problemas ? 1 : 0;
    });
