/**
 * seguranca.js — Camada de segurança para site de consultoria (Node.js + Express)
 *
 * Protege contra: XSS, clickjacking, injeção, CSRF, força bruta, spam no
 * formulário de contato, abuso por bots e excesso de requisições (alto tráfego).
 *
 * Instalação:
 *   npm install express helmet express-rate-limit cookie-parser csrf-csrf validator morgan compression
 *
 * Variáveis de ambiente (.env):
 *   NODE_ENV=production
 *   CSRF_SECRET=uma-string-longa-e-aleatoria   (gere com: openssl rand -hex 32)
 *   COOKIE_SECRET=outra-string-longa-e-aleatoria
 *   DOMINIO=https://www.seusite.com.br
 */

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const { doubleCsrf } = require("csrf-csrf");
const validator = require("validator");
const morgan = require("morgan");
const compression = require("compression");
const fs = require("fs");
const path = require("path");

const PRODUCAO = process.env.NODE_ENV === "production";
const DOMINIO = process.env.DOMINIO || "http://localhost:3000";

if (PRODUCAO && (!process.env.CSRF_SECRET || !process.env.COOKIE_SECRET)) {
  throw new Error("Defina CSRF_SECRET e COOKIE_SECRET no ambiente de produção.");
}

/* ------------------------------------------------------------------ */
/* 1. Cabeçalhos de segurança (CSP, HSTS, anti-clickjacking etc.)      */
/* ------------------------------------------------------------------ */
const cabecalhos = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"], // adicione domínios confiáveis (ex.: Google Analytics) se usar
      "style-src": ["'self'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'"],
      "frame-ancestors": ["'none'"], // impede o site de ser embutido (clickjacking)
      "form-action": ["'self'"],
      "upgrade-insecure-requests": PRODUCAO ? [] : null,
    },
  },
  strictTransportSecurity: PRODUCAO
    ? { maxAge: 63072000, includeSubDomains: true, preload: true } // 2 anos
    : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
});

function permissoes(req, res, next) {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );
  res.removeHeader("X-Powered-By");
  next();
}

/* ------------------------------------------------------------------ */
/* 2. Limite de requisições — essencial para site com muitos acessos   */
/* ------------------------------------------------------------------ */
// Geral: generoso para visitantes reais, barra bots e scrapers agressivos.
const limiteGeral = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  limit: 120, // 120 req/min por IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Tente novamente em instantes." },
  skip: (req) => /\.(css|js|png|jpe?g|webp|svg|ico|woff2?)$/i.test(req.path),
});

// Formulário de contato / agendamento: bem mais restrito contra spam.
const limiteFormulario = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { erro: "Limite de envios atingido. Aguarde 15 minutos." },
});

// Login da área administrativa: contra força bruta.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  message: { erro: "Muitas tentativas de login. Aguarde 15 minutos." },
});

/* ------------------------------------------------------------------ */
/* 3. Proteção CSRF (formulários só aceitos se vierem do próprio site) */
/* ------------------------------------------------------------------ */
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || "dev-secret-troque-em-producao",
  getSessionIdentifier: (req) => req.ip,
  cookieName: PRODUCAO ? "__Host-csrf" : "csrf",
  cookieOptions: { sameSite: "strict", secure: PRODUCAO, httpOnly: true, path: "/" },
  getCsrfTokenFromRequest: (req) => req.body?._csrf || req.headers["x-csrf-token"],
});

/* ------------------------------------------------------------------ */
/* 4. Validação e sanitização dos dados do formulário                  */
/* ------------------------------------------------------------------ */
function limpar(texto, max) {
  if (typeof texto !== "string") return "";
  return validator.escape(validator.stripLow(texto.trim(), true)).slice(0, max);
}

function validarContato(req, res, next) {
  const { nome, email, telefone, mensagem, website } = req.body || {};
  const erros = [];

  // Honeypot: campo invisível no HTML. Humanos não preenchem; bots sim.
  if (website) return res.status(200).json({ ok: true }); // finge sucesso ao bot

  if (!nome || nome.trim().length < 2) erros.push("Nome inválido.");
  if (!email || !validator.isEmail(email)) erros.push("E-mail inválido.");
  if (telefone && !validator.isMobilePhone(telefone.replace(/\D/g, ""), "pt-BR"))
    erros.push("Telefone inválido.");
  if (!mensagem || mensagem.trim().length < 10) erros.push("Mensagem muito curta.");
  if (mensagem && mensagem.length > 3000) erros.push("Mensagem muito longa.");
  if (mensagem && (mensagem.match(/https?:\/\//g) || []).length > 2)
    erros.push("Mensagem com links demais.");

  if (erros.length) return res.status(400).json({ erros });

  req.contato = {
    nome: limpar(nome, 100),
    email: validator.normalizeEmail(email),
    telefone: telefone ? telefone.replace(/\D/g, "").slice(0, 15) : null,
    mensagem: limpar(mensagem, 3000),
    recebidoEm: new Date().toISOString(),
  };
  next();
}

/* ------------------------------------------------------------------ */
/* 5. Registro de acessos (auditoria) com IP mascarado — LGPD          */
/* ------------------------------------------------------------------ */
const pastaLogs = path.join(__dirname, "logs");
fs.mkdirSync(pastaLogs, { recursive: true });

morgan.token("ip-anon", (req) => {
  const ip = req.ip || "";
  return ip.includes(":") ? ip.split(":").slice(0, 4).join(":") + "::" : ip.replace(/\.\d+$/, ".0");
});

const registroAcessos = morgan(
  ':ip-anon - [:date[iso]] ":method :url" :status :res[content-length] :response-time ms ":user-agent"',
  { stream: fs.createWriteStream(path.join(pastaLogs, "acessos.log"), { flags: "a" }) }
);

/* ------------------------------------------------------------------ */
/* 6. Bloqueio de rotas típicas de varredura de bots                   */
/* ------------------------------------------------------------------ */
const ROTAS_SUSPEITAS =
  /(wp-admin|wp-login|xmlrpc|\.env|\.git|phpmyadmin|\.php$|\/etc\/passwd|\.\.\/)/i;

function bloquearVarreduras(req, res, next) {
  if (ROTAS_SUSPEITAS.test(req.originalUrl)) return res.status(404).end();
  next();
}

/* ------------------------------------------------------------------ */
/* 7. Tratamento de erros sem vazar detalhes internos                  */
/* ------------------------------------------------------------------ */
function tratarErros(err, req, res, next) {
  if (err.code === "EBADCSRFTOKEN" || err.message?.includes("csrf")) {
    return res.status(403).json({ erro: "Sessão expirada. Recarregue a página." });
  }
  console.error(`[${new Date().toISOString()}]`, err);
  res.status(500).json({ erro: "Erro interno. Tente novamente mais tarde." });
}

/* ------------------------------------------------------------------ */
/* Aplicação: junta tudo                                               */
/* ------------------------------------------------------------------ */
function aplicarSeguranca(app) {
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // necessário atrás de Nginx, Cloudflare, Render, etc.

  app.use(compression()); // reduz banda em alto tráfego
  app.use(registroAcessos);
  app.use(bloquearVarreduras);
  app.use(cabecalhos);
  app.use(permissoes);
  app.use(limiteGeral);
  app.use(express.json({ limit: "20kb" })); // impede payloads gigantes
  app.use(express.urlencoded({ extended: false, limit: "20kb" }));
  app.use(cookieParser(process.env.COOKIE_SECRET));

  // Redireciona HTTP -> HTTPS em produção
  if (PRODUCAO) {
    app.use((req, res, next) =>
      req.secure ? next() : res.redirect(301, DOMINIO + req.originalUrl)
    );
  }
}

module.exports = {
  aplicarSeguranca,
  limiteFormulario,
  limiteLogin,
  doubleCsrfProtection,
  generateCsrfToken,
  validarContato,
  tratarErros,
};

/* ------------------------------------------------------------------ */
/* Exemplo de uso (server.js)                                          */
/* ------------------------------------------------------------------ */
if (require.main === module) {
  const app = express();
  aplicarSeguranca(app);

  app.use(express.static(path.join(__dirname, "public"), { maxAge: "7d" }));

  // Front-end busca o token antes de enviar o formulário
  app.get("/api/csrf-token", (req, res) => {
    res.json({ token: generateCsrfToken(req, res) });
  });

  app.post(
    "/api/contato",
    limiteFormulario,
    doubleCsrfProtection,
    validarContato,
    async (req, res) => {
      // Aqui: enviar e-mail / salvar no banco usando req.contato (já validado)
      console.log("Novo contato:", req.contato.email);
      res.json({ ok: true, mensagem: "Recebemos sua mensagem! Retornaremos em breve." });
    }
  );

  app.use(tratarErros);
  app.listen(process.env.PORT || 3000, () => console.log("Servidor seguro rodando."));
}
