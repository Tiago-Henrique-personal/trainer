/**
 * server.js — Servidor do site Tiago Henrique Personal
 * Usa a camada de segurança de seguranca.js
 *
 * Rodar:  npm install  →  npm start  →  http://localhost:3000
 */
const express = require("express");
const path = require("path");
const {
  aplicarSeguranca,
  limiteFormulario,
  doubleCsrfProtection,
  generateCsrfToken,
  validarContato,
  tratarErros,
} = require("./seguranca");

const app = express();
aplicarSeguranca(app);

// Arquivos do site (imagens/CSS/JS com cache de 7 dias para aguentar alto tráfego)
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "7d",
    setHeaders: (res, file) => {
      if (file.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

// Token CSRF para o formulário
app.get("/api/csrf-token", (req, res) => {
  res.json({ token: generateCsrfToken(req, res) });
});

// Recebimento do formulário de contato
app.post("/api/contato", limiteFormulario, doubleCsrfProtection, validarContato, async (req, res) => {
  // TODO: enviar e-mail (ex.: Nodemailer/Resend) ou salvar em banco usando req.contato
  console.log("Novo contato recebido:", req.contato.email, "-", req.contato.recebidoEm);
  res.json({ ok: true, mensagem: "Recebemos sua mensagem! O Tiago retorna em breve." });
});

// 404 para qualquer outra rota
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, "public", "404.html")));

app.use(tratarErros);

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => console.log(`Site rodando em http://localhost:${PORTA}`));
