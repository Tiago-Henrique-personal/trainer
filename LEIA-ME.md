# Site — Tiago Henrique Personal (Consultoria Online)

Site completo com segurança integrada (cabeçalhos de proteção, limite de requisições, CSRF, honeypot anti-spam, validação e logs com IP mascarado/LGPD).

## Estrutura
```
site/
├── server.js          → servidor (Express) que serve o site com segurança
├── seguranca.js       → camada de segurança
├── package.json
├── .env.example       → copie para .env e preencha
└── public/
    ├── index.html     → página principal
    ├── privacidade.html
    ├── 404.html
    ├── css/style.css
    ├── js/main.js
    └── img/           → logo, foto do Tiago e resultados
```

## 1. Imagens (já incluídas e otimizadas)
Em `public/img/`: `logo.png` (logo completo), `logo-icone.png` (monograma do topo), `favicon.png`, `apple-touch-icon.png`, `tiago.jpg` (foto do topo) e `resultado-1.jpg` a `resultado-3.jpg` (antes e depois). Para trocar uma foto, substitua o arquivo mantendo o mesmo nome.

## 2. O que ainda falta preencher (procure por "EDITE")
- **WhatsApp:** configurado em `public/js/main.js` (`5561994401001`). Para trocar, edite a linha `const WHATSAPP`.
- **Instagram:** (CREF 022066-C/DF já incluído) `public/index.html` (comentários indicam onde).
- **E-mail na Política de Privacidade:** `public/privacidade.html`.
- **Preços:** já preenchidos (Mensal R$ 150,00 · Trimestral R$ 359,90 · Semestral R$ 599,90). Para alterar, edite a seção `PLANOS` do `index.html`.

## 3. Rodar
```bash
npm install
cp .env.example .env      # gere os segredos: openssl rand -hex 32
npm start                 # http://localhost:3000
```
Em produção: `npm run prod` (ativa HTTPS obrigatório e HSTS).

## 4. Hospedagem sugerida
Qualquer serviço que rode Node.js: Render, Railway, Fly.io, VPS (com Nginx + Certbot). Coloque o Cloudflare na frente (plano gratuito) para cache e proteção extra contra ataques de alto volume.

## 5. Receber os contatos por e-mail
Em `server.js`, na rota `/api/contato`, troque o `console.log` pelo envio de e-mail (ex.: Nodemailer ou Resend) usando `req.contato`.
