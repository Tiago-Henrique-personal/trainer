/* =========================================================
   Tiago Henrique Personal — scripts
   ========================================================= */

// >>> EDITE AQUI: número do WhatsApp com DDI + DDD, só números (ex.: 5561999999999)
const WHATSAPP = "5561994401001";

(function () {
  "use strict";
  document.documentElement.classList.add("js");

  /* ---------- Links do WhatsApp com mensagem por plano ---------- */
  function linkWhats(plano) {
    const texto = plano
      ? `Olá, Tiago! Vim pelo site e quero contratar o plano ${plano} da consultoria online.`
      : "Olá, Tiago! Vim pelo site e quero saber mais sobre a consultoria online.";
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
  }
  const whatsConfigurado = /^\d{12,13}$/.test(WHATSAPP);
  document.querySelectorAll("[data-plano]").forEach((el) => {
    if (!whatsConfigurado) return; // enquanto o número não for configurado, os botões levam ao formulário
    el.href = linkWhats(el.dataset.plano);
    el.target = "_blank";
    el.rel = "noopener noreferrer";
  });

  /* ---------- Topo com fundo ao rolar ---------- */
  const topo = document.getElementById("topo");
  const aoRolar = () => topo && topo.classList.toggle("rolado", window.scrollY > 30);
  aoRolar();
  window.addEventListener("scroll", aoRolar, { passive: true });

  /* ---------- Menu mobile ---------- */
  const menuBtn = document.querySelector(".menu-btn");
  const menu = document.getElementById("menu");
  function fecharMenu() {
    if (!menu) return;
    menu.classList.remove("aberto");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Abrir menu");
    document.body.classList.remove("menu-aberto");
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", () => {
      const abrir = !menu.classList.contains("aberto");
      menu.classList.toggle("aberto", abrir);
      menuBtn.setAttribute("aria-expanded", String(abrir));
      menuBtn.setAttribute("aria-label", abrir ? "Fechar menu" : "Abrir menu");
      document.body.classList.toggle("menu-aberto", abrir);
    });
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", fecharMenu));
    document.addEventListener("keydown", (e) => e.key === "Escape" && fecharMenu());
  }

  /* ---------- Link ativo no menu ---------- */
  const links = menu ? [...menu.querySelectorAll('a[href^="#"]:not(.btn)')] : [];
  const secoes = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window && secoes.length) {
    const obsMenu = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((a) => a.classList.toggle("ativo", a.getAttribute("href") === "#" + en.target.id));
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    secoes.forEach((s) => obsMenu.observe(s));
  }

  /* ---------- Animação de entrada ---------- */
  const revelar = document.querySelectorAll(".revelar");
  if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("visivel");
            obs.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revelar.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 3) * 80}ms`;
      obs.observe(el);
    });
  } else {
    revelar.forEach((el) => el.classList.add("visivel"));
  }

  /* ---------- Contador do hero ---------- */
  document.querySelectorAll("[data-contar]").forEach((el) => {
    const alvo = Number(el.dataset.contar);
    const inicio = performance.now();
    const dur = 1400;
    (function passo(t) {
      const p = Math.min((t - inicio) / dur, 1);
      el.textContent = Math.round(alvo * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(passo);
    })(inicio);
  });

  /* ---------- Lightbox da galeria ---------- */
  const lightbox = document.getElementById("lightbox");
  if (lightbox && typeof lightbox.showModal === "function") {
    const lbImg = lightbox.querySelector("img");
    const lbLegenda = lightbox.querySelector(".lightbox__legenda");
    document.querySelectorAll(".galeria__item").forEach((item) => {
      item.addEventListener("click", () => {
        const img = item.querySelector("img");
        lbImg.src = img.src;
        lbImg.alt = img.alt;
        lbLegenda.textContent = item.dataset.legenda || "";
        lightbox.showModal();
      });
    });
    lightbox.querySelector(".lightbox__fechar").addEventListener("click", () => lightbox.close());
    lightbox.addEventListener("click", (e) => e.target === lightbox && lightbox.close());
  }

  /* ---------- Imagem ausente: mostra um aviso em vez de ícone quebrado ---------- */
  document.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => img.classList.add("img-ausente"), { once: true });
  });

  /* ---------- Ano no rodapé ---------- */
  const ano = document.getElementById("ano");
  if (ano) ano.textContent = new Date().getFullYear();

  /* ---------- Formulário de contato (CSRF + validação) ---------- */
  const form = document.getElementById("form-contato");
  if (!form) return;
  const retorno = document.getElementById("retorno");
  let token = null;

  async function obterToken() {
    try {
      const r = await fetch("/api/csrf-token", { credentials: "same-origin" });
      if (r.ok) token = (await r.json()).token;
    } catch (_) { /* sem servidor (ex.: abrindo o arquivo direto) */ }
  }
  obterToken();

  function mostrar(msg, tipo) {
    retorno.textContent = msg;
    retorno.className = "form__retorno " + (tipo || "");
  }

  function validarLocal() {
    let ok = true;
    const marcar = (campo, valido) => {
      campo.classList.toggle("invalido", !valido);
      campo.setAttribute("aria-invalid", String(!valido));
      if (!valido) ok = false;
    };
    marcar(form.nome, form.nome.value.trim().length >= 2);
    marcar(form.email, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.value.trim()));
    const tel = form.telefone.value.replace(/\D/g, "");
    marcar(form.telefone, tel === "" || (tel.length >= 10 && tel.length <= 13));
    marcar(form.mensagem, form.mensagem.value.trim().length >= 10);
    return ok;
  }

  // Máscara simples de telefone
  form.telefone.addEventListener("input", () => {
    let d = form.telefone.value.replace(/\D/g, "").slice(0, 11);
    if (d.length > 6) d = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    else if (d.length > 2) d = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    form.telefone.value = d;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validarLocal()) return mostrar("Confira os campos destacados.", "erro");
    if (!form.lgpd.checked) return mostrar("Para enviar, aceite a Política de Privacidade.", "erro");

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Enviando…";

    const dados = Object.fromEntries(new FormData(form));
    delete dados.lgpd;

    try {
      if (!token) await obterToken();
      const r = await fetch("/api/contato", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token || "" },
        body: JSON.stringify(dados),
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok) {
        mostrar(json.mensagem || "Mensagem enviada!", "ok");
        form.reset();
      } else {
        if (r.status === 403) await obterToken(); // token expirado: renova
        mostrar((json.erros && json.erros.join(" ")) || json.erro || "Não foi possível enviar.", "erro");
      }
    } catch (_) {
      mostrar("Falha de conexão. Tente novamente ou chame no WhatsApp.", "erro");
    } finally {
      btn.disabled = false;
      btn.textContent = "Enviar mensagem";
    }
  });
})();
