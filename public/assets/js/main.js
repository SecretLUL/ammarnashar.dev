/* ammarnashar.dev: interactions and motion.
   Uses gsap + ScrollTrigger + Lenis from /assets/vendor (loaded with defer before this file).
   Without them, or with "reduce motion" switched on, the page stays static and fully usable. */
(() => {
  "use strict";

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const reduced = root.classList.contains("reduced");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const canAnimate = !reduced && typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

  let lenis = null;

  // ---------- Always on ----------
  const menu = setupMenu();
  setupYear();
  setupClock();
  setupCopy();
  setupAnchors();
  setupNavActive();
  setupNavScroll();
  setupLiveData();

  if (!canAnimate) {
    // Static page: drop the animation start states from main.css.
    root.classList.remove("js", "show-intro");
    root.classList.add("ready");
    return;
  }

  try {
    gsap.registerPlugin(ScrollTrigger);
    lenis = setupLenis();
    setupHero(setupCanvas());
    setupReveals();
    setupAboutScrub();
    setupCounters();
    setupMarquee();
    setupStack();
    setupTilt();
    setupScanDemo();
    setupSottoDemo();
    setupMcDemo();
    setupBento();
    setupSteps();
    setupOrbs();
    setupCursor();
    setupMagnetic();
    setupContactGlow();
    gsap.to(".scroll-progress span", {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
    root.classList.add("ready");
  } catch (err) {
    console.error("[portfolio] animation setup failed, showing the static page instead", err);
    fallBackToStatic();
  }

  function fallBackToStatic() {
    try {
      ScrollTrigger.getAll().forEach((t) => t.kill());
      gsap.globalTimeline.getChildren().forEach((t) => t.kill());
      gsap.set(
        "[data-hero], [data-reveal], [data-reveal-group] > *, [data-words], [data-scrub], .orb, .project, .project-card, .footer-big span, .w-in, .sw, .rot-item, .intro",
        { clearProps: "all" }
      );
    } catch (e) {
      /* nothing left to undo */
    }
    if (lenis) lenis.destroy();
    lenis = null;
    root.classList.remove("js", "show-intro", "has-cursor");
    root.classList.add("ready");
  }

  // =====================================================================
  // Basics
  // =====================================================================

  function setupYear() {
    $$("[data-year]").forEach((el) => (el.textContent = String(new Date().getFullYear())));
  }

  function setupClock() {
    const el = $("[data-clock]");
    if (!el) return;
    const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
    const tick = () => (el.textContent = fmt.format(new Date()));
    tick();
    setInterval(tick, 15000);
  }

  function setupMenu() {
    const btn = $(".menu-btn");
    const panel = $("#menu");
    let open = false;
    const set = (value) => {
      if (!btn || !panel || value === open) return;
      open = value;
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      panel.hidden = !open;
      root.classList.toggle("menu-open", open);
      if (lenis) open ? lenis.stop() : lenis.start();
      if (open && canAnimate) {
        gsap.fromTo(
          $$("a", panel),
          { yPercent: 60, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.8, stagger: 0.06, ease: "expo.out" }
        );
      }
    };
    if (btn) btn.addEventListener("click", () => set(!open));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) {
        set(false);
        btn.focus();
      }
    });
    window.addEventListener("resize", () => {
      if (open && window.innerWidth > 860) set(false);
    });
    return { close: () => set(false), isOpen: () => open };
  }

  // ---------- Copy to clipboard ----------
  function setupCopy() {
    const toast = $(".toast");
    const toastText = $(".toast-text");
    const resetTimers = new WeakMap();
    let toastTimer = 0;

    const showToast = (msg) => {
      if (!toast) return;
      toastText.textContent = msg;
      toast.classList.add("is-on");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("is-on"), 2200);
    };

    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-copy], [data-copy-email]");
      if (!btn) return;
      const isEmail = btn.hasAttribute("data-copy-email");
      const email = isEmail ? contactEmail() : "";
      try {
        if (isEmail && !email) throw new Error("no address on the page");
        await copyText(isEmail ? email : btn.dataset.copy);
        showToast(isEmail ? "E-mail address copied" : btn.dataset.copyToast || "Command copied, paste it into a terminal");
        const label = $("[data-copy-label]", btn);
        if (label) {
          if (!label.dataset.orig) label.dataset.orig = label.textContent;
          label.textContent = "Copied!";
          clearTimeout(resetTimers.get(btn));
          resetTimers.set(btn, setTimeout(() => (label.textContent = label.dataset.orig), 1800));
        }
      } catch (err) {
        showToast(email || "Couldn't copy, sorry");
      }
    });
  }

  // The address is not in this file or in the repository: server.ts writes it into the mailto links.
  // On the live site Cloudflare obfuscates it there, and its decoder (a plain script at the end of
  // <body>) restores it before this deferred script runs. Should the decoder not have run, its
  // format is decoded here: hex bytes, the first one is the XOR key for the others.
  function contactEmail() {
    const link = $('a[href^="mailto:"]');
    if (link) return link.getAttribute("href").slice(7).split("?")[0];
    const coded = $("[data-cfemail]");
    const hex = coded ? coded.dataset.cfemail : "";
    const key = parseInt(hex.slice(0, 2), 16);
    let out = "";
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return out;
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    // Fallback for plain http (e.g. when the server is opened directly on the local network)
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("copy failed");
  }

  // ---------- In-page links (smooth with Lenis, native otherwise) ----------
  function setupAnchors() {
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute("href");
      const toTop = hash === "#" || hash === "#top";
      const target = toTop ? null : document.getElementById(hash.slice(1));
      if (!toTop && !target) return;
      e.preventDefault();
      menu.close();

      const offset = target ? -offsetFor(target) : 0;
      if (lenis) {
        lenis.scrollTo(target || 0, { offset, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
      } else {
        const top = target ? target.getBoundingClientRect().top + window.scrollY + offset : 0;
        window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
      }
      if (target && target.id === "main") target.focus({ preventScroll: true });
      history.replaceState(null, "", toTop ? location.pathname + location.search : hash);
    });
  }

  // Sticky project cards should land at their sticky position, below the nav.
  function offsetFor(el) {
    if (!el.classList.contains("project")) return 0;
    const style = getComputedStyle(el);
    return style.position === "sticky" ? parseFloat(style.top) || 96 : 96;
  }

  // ---------- Nav: active section pill ----------
  function setupNavActive() {
    const links = $$(".nav-links a");
    const pill = $(".nav-pill");
    if (!links.length || !pill) return;
    const linkFor = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const sections = $$("main section[id]").filter((s) => linkFor.has(s.dataset.nav || s.id));
    const visible = new Set();

    const place = (link) => {
      links.forEach((l) => l.classList.toggle("is-active", l === link));
      if (!link) {
        pill.style.opacity = "0";
        return;
      }
      pill.style.width = `${link.offsetWidth}px`;
      pill.style.transform = `translateX(${link.offsetLeft}px)`;
      pill.style.opacity = "1";
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => (en.isIntersecting ? visible.add(en.target) : visible.delete(en.target)));
        const current = sections.find((s) => visible.has(s));
        place(current ? linkFor.get(current.dataset.nav || current.id) : null);
      },
      { rootMargin: "-45% 0px -54% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    window.addEventListener("resize", () => {
      const active = links.find((l) => l.classList.contains("is-active"));
      if (active) place(active);
    });
  }

  // ---------- Nav: transparent at the top, hides while scrolling down ----------
  function setupNavScroll() {
    const nav = $(".nav");
    if (!nav) return;
    let last = window.scrollY;
    const update = (y) => {
      nav.classList.toggle("at-top", y < 30);
      const delta = y - last;
      if (Math.abs(delta) > 6) {
        nav.classList.toggle("is-hidden", delta > 0 && y > 520 && !menu.isOpen());
        last = y;
      }
    };
    update(window.scrollY);
    // Lenis drives the native scroll position, so the plain scroll event covers both cases.
    window.addEventListener("scroll", () => update(window.scrollY), { passive: true });
    nav.addEventListener("focusin", () => nav.classList.remove("is-hidden"));
  }

  // ---------- Latest releases + commit count (cached by the server, never from the browser to GitHub) ----------
  function setupLiveData() {
    fetch("/api/projects", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !data.repos) return;
        const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
        $$("[data-release]").forEach((el) => {
          const info = data.repos[el.dataset.release];
          if (!info || !info.version) return;
          const text = $(".release-text", el);
          text.textContent = info.published ? `${info.version} · ${timeAgo(info.published, rtf)}` : info.version;
          if (info.published) {
            const date = new Date(info.published).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            el.title = `Latest release, published ${date}`;
          }
        });

        const total = Object.values(data.repos).reduce((sum, r) => sum + (r.commits || 0), 0);
        const el = $('[data-live="commits"]');
        if (el && total >= 10) {
          const value = Math.floor(total / 10) * 10; // shown as "430+"
          el.dataset.count = String(value);
          if (el.dataset.counted || !canAnimate) el.textContent = String(value);
        }
      })
      .catch(() => {
        /* offline or API down: the numbers in the HTML stay */
      });
  }

  function timeAgo(iso, rtf) {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    const units = [
      ["year", 31536000],
      ["month", 2592000],
      ["week", 604800],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
    ];
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return "just now";
  }

  // =====================================================================
  // Motion
  // =====================================================================

  function setupLenis() {
    if (typeof window.Lenis === "undefined") return null;
    const instance = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    });
    instance.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => instance.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    return instance;
  }

  // Wraps each word in <span class="w"><span class="w-in">word</span></span> (masked slide-up),
  // or with mask:false in <span class="sw">word</span> (scroll highlight). Keeps <em> and .hl.
  function splitWords(el, { mask = true } = {}) {
    const out = [];
    const walk = (node, ctx) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          for (const part of child.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) {
              frag.append(" ");
              continue;
            }
            const inner = document.createElement("span");
            inner.textContent = part;
            if (mask) {
              const outer = document.createElement("span");
              outer.className = "w";
              inner.className = ctx.em ? "w-in grad" : "w-in";
              outer.append(inner);
              frag.append(outer);
            } else {
              inner.className = "sw";
              frag.append(inner);
            }
            out.push(inner);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.tagName === "EM") child.classList.add("split");
          walk(child, { em: ctx.em || child.tagName === "EM" });
        }
      }
    };
    walk(el, { em: false });
    return out;
  }

  // The same word masks for the hero line, whose words are in data-text and drawn by CSS
  // (.hero-title [data-text] in main.css), so the headline is not twice in the page text.
  function splitDataText(el) {
    const words = (el.dataset.text || "").split(/\s+/).filter(Boolean);
    el.removeAttribute("data-text");
    return words.map((word, i) => {
      const outer = document.createElement("span");
      const inner = document.createElement("span");
      outer.className = "w";
      inner.className = "w-in";
      inner.dataset.text = word;
      outer.append(inner);
      el.append(outer);
      if (i < words.length - 1) el.append(" ");
      return inner;
    });
  }

  // ---------- Hero: heartbeat intro, headline, rotating phrase ----------
  function setupHero(dots) {
    const hasIntro = root.classList.contains("show-intro");
    const line = $(".hero-line");
    const words = line ? splitDataText(line) : [];
    gsap.set(line, { opacity: 1 });
    gsap.set(words, { yPercent: 115 });
    if (hasIntro && lenis) lenis.stop();

    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    if (hasIntro) {
      try {
        sessionStorage.setItem("intro-seen", "1");
      } catch (e) {
        /* ignore */
      }
      tl.to(".intro-line", { strokeDashoffset: 0, duration: 1.05, ease: "power2.inOut" })
        .to(".intro-mark", { scale: 0.86, opacity: 0, duration: 0.45, ease: "power2.in" }, "+=0.15")
        .to(".intro", { yPercent: -100, duration: 0.95, ease: "expo.inOut" }, "-=0.12")
        .add(() => {
          root.classList.remove("show-intro");
          gsap.set(".intro", { clearProps: "all" });
          if (lenis) lenis.start();
        });
    }

    tl.addLabel("hero", hasIntro ? "-=0.55" : 0.15)
      .fromTo(".hero-pill", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, "hero")
      .fromTo(".hero-hey", { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, "hero+=0.08")
      .to(words, { yPercent: 0, duration: 1.25, stagger: 0.07 }, "hero+=0.14")
      .fromTo(
        ".rot-item.is-active",
        { yPercent: 105, opacity: 0, filter: "blur(10px)" },
        { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 1.3 },
        "hero+=0.42"
      )
      .fromTo(".hero-sub", { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, "hero+=0.6")
      .fromTo(".hero-cta", { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, "hero+=0.72")
      .fromTo(
        ".orb",
        { scale: 0.4, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1.3, stagger: 0.12, ease: "back.out(1.6)" },
        "hero+=0.55"
      )
      .fromTo(".scroll-cue", { opacity: 0 }, { opacity: 1, duration: 1 }, "hero+=1.1")
      .add(() => {
        if (dots) dots.show();
        startRotator();
      }, "hero+=0.9");

    // Leaving the hero: the content drifts up and fades out
    const leave = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
    gsap.to(".hero-inner", { yPercent: -14, opacity: 0.15, ease: "none", scrollTrigger: leave });
    gsap.to(".hero-orbit", { yPercent: -28, ease: "none", scrollTrigger: { ...leave } });
  }

  function startRotator() {
    const items = $$(".rot-item");
    const orbs = $$(".orb");
    if (items.length < 2) return;
    let index = Math.max(0, items.findIndex((i) => i.classList.contains("is-active")));
    const mark = (i) => orbs.forEach((o) => o.classList.toggle("is-active", Number(o.dataset.orb) === i));
    mark(index);

    const step = () => {
      const current = items[index];
      index = (index + 1) % items.length;
      const next = items[index];
      gsap.to(current, { yPercent: -105, opacity: 0, filter: "blur(8px)", duration: 0.9, ease: "expo.inOut" });
      gsap.fromTo(
        next,
        { yPercent: 105, opacity: 0, filter: "blur(8px)" },
        { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 0.9, ease: "expo.inOut" }
      );
      current.classList.remove("is-active");
      next.classList.add("is-active");
      gsap.delayedCall(0.35, mark, [index]); // light the icon once the new phrase is half in
    };

    let timer = 0;
    let inView = true;
    const play = () => {
      if (!timer && inView && !document.hidden) timer = setInterval(step, 2900);
    };
    const pause = () => {
      clearInterval(timer);
      timer = 0;
    };
    play();
    ScrollTrigger.create({
      trigger: ".hero",
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => {
        inView = self.isActive;
        inView ? play() : pause();
      },
    });
    document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
  }

  // ---------- Generic reveals ----------
  function setupReveals() {
    const start = "clamp(top 88%)";
    $$("[data-reveal]").forEach((el) => {
      gsap.fromTo(
        el,
        { y: 36, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start, once: true } }
      );
    });
    $$("[data-reveal-group]").forEach((group) => {
      gsap.fromTo(
        group.children,
        { y: 36, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1.2,
          stagger: 0.08,
          ease: "expo.out",
          scrollTrigger: { trigger: group, start, once: true },
        }
      );
    });
    $$("[data-words]").forEach((el) => {
      if (el.classList.contains("hero-line")) return;
      const words = splitWords(el);
      gsap.set(el, { opacity: 1 });
      gsap.fromTo(
        words,
        { yPercent: 115 },
        {
          yPercent: 0,
          duration: 1.3,
          stagger: 0.06,
          ease: "expo.out",
          scrollTrigger: { trigger: el, start: "clamp(top 86%)", once: true },
        }
      );
    });
    // Project cards rise in (the article moves; the card inside is free for the stacking scale)
    $$(".project").forEach((project) => {
      gsap.fromTo(
        project,
        { y: 90, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1.4,
          ease: "expo.out",
          scrollTrigger: { trigger: project, start: "clamp(top 92%)", once: true },
        }
      );
    });
    gsap.fromTo(
      ".footer-big span",
      { yPercent: 55, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 1.5,
        stagger: 0.12,
        ease: "expo.out",
        scrollTrigger: { trigger: ".footer", start: "clamp(top 96%)", once: true },
      }
    );
  }

  // ---------- About: words light up while scrolling ----------
  function setupAboutScrub() {
    const el = $("[data-scrub]");
    if (!el) return;
    const words = splitWords(el, { mask: false });
    gsap.set(el, { opacity: 1 });
    gsap.fromTo(
      words,
      { opacity: 0.14 },
      {
        opacity: 1,
        ease: "none",
        stagger: 0.05,
        scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 50%", scrub: 0.8 },
      }
    );
  }

  // ---------- Counters (zero counts down, because "0 trackers" deserves a moment) ----------
  function setupCounters() {
    $$("[data-count]").forEach((el) => {
      const end = () => parseFloat(el.dataset.count) || 0;
      const from = end() === 0 ? 99 : 0;
      el.textContent = String(from);
      ScrollTrigger.create({
        trigger: el,
        start: "clamp(top 92%)",
        once: true,
        onEnter: () => {
          const target = end();
          const state = { v: from };
          gsap.to(state, {
            v: target,
            duration: target > 50 ? 2.2 : 1.6,
            ease: "power3.out",
            onUpdate: () => (el.textContent = String(Math.round(state.v))),
            onComplete: () => {
              el.dataset.counted = "1";
              el.textContent = String(end()); // live data may have arrived meanwhile
            },
          });
        },
      });
    });
  }

  // ---------- Marquee: endless, speeds up with the scroll velocity ----------
  function setupMarquee() {
    const tweens = $$(".marquee-track").map((track, i) => {
      track.append(...Array.from(track.childNodes).map((n) => n.cloneNode(true)));
      const toLeft = i % 2 === 0;
      return gsap.fromTo(
        track,
        { xPercent: toLeft ? 0 : -50 },
        { xPercent: toLeft ? -50 : 0, duration: 46, ease: "none", repeat: -1 }
      );
    });
    if (!tweens.length) return;
    let boost = 0;
    if (lenis) lenis.on("scroll", (e) => (boost = Math.min(Math.abs(e.velocity) / 5, 7)));
    gsap.ticker.add(() => {
      boost *= 0.93;
      tweens.forEach((t) => t.timeScale(1 + boost));
    });
    const st = ScrollTrigger.create({
      trigger: ".marquee",
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => tweens.forEach((t) => (self.isActive ? t.resume() : t.pause())),
    });
    if (!st.isActive) tweens.forEach((t) => t.pause());
  }

  // ---------- Project cards: stacking on large screens ----------
  function setupStack() {
    const stack = $(".stack");
    if (!stack) return;
    const projects = $$(".project", stack);
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px) and (min-height: 800px)", () => {
      // Natural (un-stuck) top of card i. A stuck sticky element reports its stuck position,
      // so this is computed from the static .stack and the card heights instead.
      const naturalTop = (index) => {
        const gap = parseFloat(getComputedStyle(stack).rowGap) || 0;
        let top = stack.getBoundingClientRect().top + window.scrollY;
        for (let k = 0; k < index; k++) top += projects[k].offsetHeight + gap;
        return top;
      };
      projects.forEach((project, i) => {
        const next = projects[i + 1];
        if (!next) return;
        gsap
          .timeline({
            scrollTrigger: {
              start: () => naturalTop(i + 1) - window.innerHeight,
              end: () => naturalTop(i + 1) - parseFloat(getComputedStyle(next).top),
              scrub: true,
              invalidateOnRefresh: true,
            },
          })
          .fromTo($(".project-card", project), { scale: 1 }, { scale: 0.92, ease: "none" }, 0)
          .fromTo($(".project-shade", project), { opacity: 0 }, { opacity: 0.62, ease: "none" }, 0);
      });
    });
  }

  // ---------- 3D tilt on the project visuals ----------
  function setupTilt() {
    if (!finePointer) return;
    $$("[data-tilt]").forEach((box) => {
      const layers = $$(".tilt-layer", box).map((el) => {
        const opts = { duration: 0.9, ease: "power3.out" };
        return {
          depth: parseFloat(el.dataset.depth || "1"),
          rx: gsap.quickTo(el, "rotationX", opts),
          ry: gsap.quickTo(el, "rotationY", opts),
          x: gsap.quickTo(el, "x", opts),
          y: gsap.quickTo(el, "y", opts),
        };
      });
      const glares = $$(".glare", box);
      box.addEventListener("pointermove", (e) => {
        const r = box.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        layers.forEach((l) => {
          l.ry(px * 9);
          l.rx(-py * 7);
          l.x(px * 10 * l.depth);
          l.y(py * 10 * l.depth);
        });
        glares.forEach((g) => {
          const gr = g.getBoundingClientRect();
          g.style.setProperty("--gx", `${e.clientX - gr.left}px`);
          g.style.setProperty("--gy", `${e.clientY - gr.top}px`);
        });
      });
      box.addEventListener("pointerleave", () =>
        layers.forEach((l) => {
          l.rx(0);
          l.ry(0);
          l.x(0);
          l.y(0);
        })
      );
    });
  }

  function playWhenVisible(el, tl, onToggle) {
    ScrollTrigger.create({
      trigger: el,
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => {
        self.isActive ? tl.play() : tl.pause();
        if (onToggle) onToggle(self.isActive);
      },
    });
  }

  // ---------- WinMedic: little scan card ----------
  function setupScanDemo() {
    const card = $(".scan-card");
    if (!card) return;
    const items = $$(".scan-list li", card);
    const pct = $(".scan-pct", card);
    const title = $(".scan-title", card);
    const bar = $(".scan-bar i", card);
    const progress = { p: 0 };
    const render = () => {
      pct.textContent = `${Math.round(progress.p)}%`;
      bar.style.transform = `scaleX(${progress.p / 100})`;
    };
    const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2 });
    tl.call(() => {
      items.forEach((li) => li.classList.remove("is-busy", "is-done"));
      title.textContent = "Scanning";
      progress.p = 0;
      render();
    });
    items.forEach((li, i) => {
      tl.call(() => li.classList.add("is-busy"))
        .to(progress, { p: ((i + 1) / items.length) * 100, duration: 0.6 + (i % 3) * 0.15, ease: "power1.inOut", onUpdate: render })
        .call(() => {
          li.classList.remove("is-busy");
          li.classList.add("is-done");
        });
    });
    tl.call(() => (title.textContent = "Scan done")).to({}, { duration: 2.8 });
    playWhenVisible(card, tl);
  }

  // ---------- Sotto: two tracks + live transcript ----------
  function setupSottoDemo() {
    const app = $(".sotto-app");
    if (!app) return;
    app.classList.add("demo-on");
    for (const wave of $$(".wave", app)) {
      for (let i = 0; i < 44; i++) {
        const bar = document.createElement("i");
        bar.style.setProperty("--h", (0.25 + Math.random() * 0.75).toFixed(2));
        bar.style.setProperty("--d", `${(-Math.random() * 0.9).toFixed(2)}s`);
        wave.append(bar);
      }
    }
    const tracks = { you: $(".track-you", app), them: $(".track-them", app) };
    const talk = (who) => {
      tracks.you.classList.toggle("is-talking", who === "you");
      tracks.them.classList.toggle("is-talking", who === "them");
    };
    const lines = $$(".t-line", app).map((line) => {
      const text = $(".t-text", line);
      return { line, text, full: text.textContent, who: line.classList.contains("is-you") ? "you" : "them" };
    });

    const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1 });
    tl.call(() => {
      lines.forEach((l) => {
        l.text.textContent = "";
        l.line.classList.remove("is-shown", "is-typing");
      });
      talk(null);
    });
    lines.forEach((l) => {
      const typed = { n: 0 };
      tl.call(
        () => {
          talk(l.who);
          l.line.classList.add("is-shown", "is-typing");
        },
        null,
        "+=0.6"
      )
        .fromTo(
          typed,
          { n: 0 },
          {
            n: l.full.length,
            duration: l.full.length * 0.045,
            ease: "none",
            onUpdate: () => (l.text.textContent = l.full.slice(0, Math.round(typed.n))),
          }
        )
        .call(() => l.line.classList.remove("is-typing"));
    });
    tl.call(() => talk(null), null, "+=0.4").to({}, { duration: 2.8 });

    const recTime = $(".rec-time", app);
    let seconds = 0;
    let timer = 0;
    const tick = () => {
      seconds++;
      recTime.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    };
    playWhenVisible(app, tl, (on) => {
      clearInterval(timer);
      timer = on ? setInterval(tick, 1000) : 0;
    });
  }

  // ---------- MCmodsLoader: one click, twenty mods ----------
  function setupMcDemo() {
    const app = $(".mc-app");
    if (!app) return;
    const rows = $$(".mc-mods li", app);
    const more = rows.pop(); // "+ 14 more"
    const bar = $(".mc-progress i", app);
    const btn = $(".mc-btn", app);
    const label = $(".mc-btn-text", app);
    const idle = label.textContent;

    const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2 });
    tl.call(() => {
      rows.concat(more).forEach((m) => m.classList.remove("is-busy", "is-done"));
      btn.classList.remove("is-busy");
      label.textContent = idle;
    })
      .set(bar, { scaleX: 0 })
      .to(btn, { scale: 0.95, duration: 0.14, ease: "power2.out" }, "+=0.9")
      .to(btn, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" })
      .call(
        () => {
          btn.classList.add("is-busy");
          label.textContent = "Injecting mods…";
        },
        null,
        "<"
      );
    rows.forEach((m, i) => {
      tl.call(() => m.classList.add("is-busy"))
        .to(bar, { scaleX: (i + 1) / (rows.length + 1), duration: 0.38, ease: "power1.inOut" })
        .call(() => {
          m.classList.remove("is-busy");
          m.classList.add("is-done");
        });
    });
    tl.to(bar, { scaleX: 1, duration: 0.5, ease: "power1.inOut" })
      .call(() => {
        more.classList.add("is-done");
        btn.classList.remove("is-busy");
        label.textContent = "Done, enjoy the FPS!";
      })
      .to({}, { duration: 2.8 });
    playWhenVisible(app, tl);
  }

  // ---------- Bento: cursor spotlight, commit grid, checksum ----------
  function setupBento() {
    const bento = $(".bento");
    if (!bento) return;
    const tiles = $$(".tile", bento);
    if (finePointer) {
      bento.addEventListener("pointermove", (e) => {
        for (const t of tiles) {
          const r = t.getBoundingClientRect();
          t.style.setProperty("--mx", `${e.clientX - r.left}px`);
          t.style.setProperty("--my", `${e.clientY - r.top}px`);
        }
      });
      bento.addEventListener("pointerleave", () =>
        tiles.forEach((t) => {
          t.style.removeProperty("--mx");
          t.style.removeProperty("--my");
        })
      );
    }

    const grid = $(".contrib");
    if (grid) {
      const weights = [0.34, 0.26, 0.2, 0.12, 0.08];
      const level = () => {
        let r = Math.random();
        let l = 0;
        while (l < weights.length - 1 && r > weights[l]) r -= weights[l++];
        return String(l);
      };
      const cells = [];
      for (let i = 0; i < 7 * 20; i++) {
        const c = document.createElement("i");
        c.dataset.l = level();
        grid.append(c);
        cells.push(c);
      }
      gsap.fromTo(
        cells,
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.6,
          ease: "back.out(2)",
          stagger: { amount: 1.1, grid: "auto", from: "start" },
          scrollTrigger: { trigger: grid, start: "clamp(top 92%)", once: true },
        }
      );
      setInterval(() => {
        if (document.hidden) return;
        cells[(Math.random() * cells.length) | 0].dataset.l = level();
      }, 700);
    }

    const hash = $("[data-scramble]");
    if (hash) {
      const run = () => scramble(hash);
      ScrollTrigger.create({ trigger: hash, start: "clamp(top 92%)", onEnter: run, onEnterBack: run });
    }
  }

  function scramble(el) {
    const final = el.dataset.final || (el.dataset.final = el.textContent);
    const hex = "0123456789abcdef";
    const frames = 28;
    let frame = 0;
    const tick = () => {
      const done = Math.floor((frame / frames) * final.length);
      el.textContent = Array.from(final, (ch, i) => (i < done || ch === "…" ? ch : hex[(Math.random() * 16) | 0])).join("");
      if (frame++ < frames) requestAnimationFrame(tick);
      else el.textContent = final;
    };
    tick();
  }

  // ---------- How I work: the line draws itself, steps light up ----------
  function setupSteps() {
    const wrap = $(".steps-wrap");
    if (!wrap) return;
    gsap.fromTo(
      ".steps-line i",
      { scaleY: 0 },
      { scaleY: 1, ease: "none", scrollTrigger: { trigger: wrap, start: "top 62%", end: "bottom 62%", scrub: 0.4 } }
    );
    $$(".step", wrap).forEach((step) => {
      ScrollTrigger.create({
        trigger: step,
        start: "top+=8 62%",
        onEnter: () => step.classList.add("is-active"),
        onLeaveBack: () => step.classList.remove("is-active"),
      });
    });
  }

  // ---------- Hero background: dot grid that glows around the cursor ----------
  // The radial fade-out and the fade-in are applied per dot here. As a CSS mask-image plus an
  // opacity transition on the canvas they made Firefox recomposite the whole canvas layer on every
  // frame, which made the first seconds after loading the page stutter heavily.
  function setupCanvas() {
    const canvas = $(".hero-canvas");
    const hero = $(".hero");
    if (!canvas || !hero) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const FADE_MS = 1600;
    const MIN_FRAME_MS = 12; // at most ~80 redraws per second, also on 120/144 Hz screens

    let w = 0;
    let h = 0;
    let gap = 26;
    let cols = 0;
    let rows = 0;
    let ox = 0;
    let oy = 0;
    let fadeOut = new Float32Array(0); // per dot, 0 = outside the ellipse (not drawn)
    let colWave = new Float32Array(0);
    let rowWave = new Float32Array(0);
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, seen: false };
    let shownAt = -1;
    let running = false;
    let inView = true;
    let raf = 0;
    let last = 0;
    const t0 = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (Math.abs(rect.width - w) < 1 && Math.abs(rect.height - h) < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gap = w < 700 ? 22 : 26;
      cols = Math.ceil(w / gap) + 1;
      rows = Math.ceil(h / gap) + 1;
      ox = (w - (cols - 1) * gap) / 2;
      oy = (h - (rows - 1) * gap) / 2;
      // the shape of the former CSS mask: radial-gradient(ellipse 72% 62% at 50% 46%, #000 30%, transparent 78%)
      fadeOut = new Float32Array(cols * rows);
      for (let j = 0; j < rows; j++) {
        const v = (oy + j * gap - h * 0.46) / (h * 0.62);
        for (let i = 0; i < cols; i++) {
          const u = (ox + i * gap - w * 0.5) / (w * 0.72);
          const p = Math.sqrt(u * u + v * v);
          fadeOut[j * cols + i] = p <= 0.3 ? 1 : p >= 0.78 ? 0 : (0.78 - p) / 0.48;
        }
      }
      colWave = new Float32Array(cols);
      rowWave = new Float32Array(rows);
      last = 0; // resizing clears the canvas: draw again on the next frame
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (last && now - last < MIN_FRAME_MS) return;
      const dt = last ? Math.min(now - last, 100) : 1000 / 60;
      last = now;
      const t = (now - t0) / 1000;
      if (!finePointer || !mouse.seen) {
        // no mouse: a slow wandering light instead
        mouse.tx = w * (0.5 + 0.3 * Math.sin(t * 0.33));
        mouse.ty = h * (0.46 + 0.2 * Math.sin(t * 0.47 + 1.3));
      }
      const follow = 1 - Math.pow(0.91, dt / (1000 / 60)); // 9 % per 60 Hz frame, at any frame rate
      mouse.x += (mouse.tx - mouse.x) * follow;
      mouse.y += (mouse.ty - mouse.y) * follow;
      const p = Math.min(1, Math.max(0, (now - shownAt) / FADE_MS));
      const fadeIn = p * (2 - p);

      // the wave is sin(column) * cos(row): one sin per column and one cos per row instead of per dot
      for (let i = 0; i < cols; i++) colWave[i] = Math.sin(i * 0.32 + t * 0.8);
      for (let j = 0; j < rows; j++) rowWave[j] = Math.cos(j * 0.28 - t * 0.6);

      ctx.clearRect(0, 0, w, h);
      const R = Math.max(140, Math.min(230, w * 0.22));
      const R2 = R * R;
      let style = "";
      for (let j = 0; j < rows; j++) {
        const y0 = oy + j * gap;
        for (let i = 0; i < cols; i++) {
          const edge = fadeOut[j * cols + i];
          if (edge === 0) continue;
          const x0 = ox + i * gap;
          let alpha = 0.1 + colWave[i] * rowWave[j] * 0.055;
          let size = 1.2;
          let x = x0;
          let y = y0;
          let near = false;
          const dx = x0 - mouse.x;
          const dy = y0 - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const d = Math.sqrt(d2) || 1;
            const f = 1 - d / R;
            const f2 = f * f;
            alpha += f2 * 0.85;
            size += f2 * 1.8;
            x += (dx / d) * f2 * 9;
            y += (dy / d) * f2 * 9;
            near = f > 0.12;
          }
          alpha = (alpha > 1 ? 1 : alpha) * edge * fadeIn;
          if (alpha < 0.004) continue; // invisible anyway
          const fill = near ? "#86efac" : "#cfe9d9";
          if (fill !== style) {
            ctx.fillStyle = fill;
            style = fill;
          }
          ctx.globalAlpha = alpha;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;
    };

    // Nothing is drawn before show(): until then the grid would be invisible anyway.
    const start = () => {
      if (running || shownAt < 0 || !inView || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    window.addEventListener("resize", resize);
    if (finePointer) {
      window.addEventListener(
        "pointermove",
        (e) => {
          const r = canvas.getBoundingClientRect();
          mouse.tx = e.clientX - r.left;
          mouse.ty = e.clientY - r.top;
          if (!mouse.seen) {
            mouse.seen = true;
            mouse.x = mouse.tx;
            mouse.y = mouse.ty;
          }
        },
        { passive: true }
      );
    }
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      inView ? start() : stop();
    }).observe(hero);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    return {
      show() {
        if (shownAt >= 0) return;
        shownAt = performance.now();
        start();
      },
    };
  }

  // ---------- Hero project icons follow the mouse a little ----------
  function setupOrbs() {
    if (!finePointer) return;
    const orbs = $$(".orb").map((el) => {
      const depth = parseFloat(el.dataset.depth || "1");
      const opts = { duration: 1.2, ease: "power3.out" };
      return { depth, x: gsap.quickTo(el, "x", opts), y: gsap.quickTo(el, "y", opts) };
    });
    window.addEventListener(
      "pointermove",
      (e) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        orbs.forEach((o) => {
          o.x(nx * 44 * o.depth);
          o.y(ny * 32 * o.depth);
        });
      },
      { passive: true }
    );
  }

  // ---------- Custom cursor (mouse only) ----------
  function setupCursor() {
    if (!finePointer) return;
    const cursor = $(".cursor");
    const dot = $(".cursor-dot");
    const ring = $(".cursor-ring");
    const label = $(".cursor-label");
    if (!cursor || !dot || !ring) return;
    cursor.classList.add("is-hidden");
    const dotX = gsap.quickSetter(dot, "x", "px");
    const dotY = gsap.quickSetter(dot, "y", "px");
    const ringX = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3.out" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3.out" });
    let seen = false;

    window.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        if (!seen) {
          seen = true;
          root.classList.add("has-cursor");
          gsap.set(ring, { x: e.clientX, y: e.clientY });
        }
        cursor.classList.remove("is-hidden");
        dotX(e.clientX);
        dotY(e.clientY);
        ringX(e.clientX);
        ringY(e.clientY);
      },
      { passive: true }
    );
    document.documentElement.addEventListener("mouseleave", () => cursor.classList.add("is-hidden"));
    window.addEventListener("pointerdown", () => cursor.classList.add("is-down"));
    window.addEventListener("pointerup", () => cursor.classList.remove("is-down"));
    document.addEventListener("pointerover", (e) => {
      const target = e.target.closest("a, button, [data-cursor]");
      const text = target ? target.dataset.cursor : "";
      if (text && text !== "hover") {
        label.textContent = text;
        cursor.classList.add("has-label");
        cursor.classList.remove("is-hover");
      } else {
        cursor.classList.toggle("is-hover", Boolean(target));
        cursor.classList.remove("has-label");
      }
    });
  }

  // ---------- Buttons lean towards the cursor ----------
  function setupMagnetic() {
    if (!finePointer) return;
    $$("[data-magnetic]").forEach((el) => {
      const opts = { duration: 0.8, ease: "elastic.out(1, 0.45)" };
      const x = gsap.quickTo(el, "x", opts);
      const y = gsap.quickTo(el, "y", opts);
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.28);
        y((e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      el.addEventListener("pointerleave", () => {
        x(0);
        y(0);
      });
    });
  }

  // ---------- Contact: the glow drifts after the mouse ----------
  function setupContactGlow() {
    if (!finePointer) return;
    const section = $(".contact");
    const glow = $(".contact-glow");
    if (!section || !glow) return;
    const opts = { duration: 1.4, ease: "power3.out" };
    const x = gsap.quickTo(glow, "x", opts);
    const y = gsap.quickTo(glow, "y", opts);
    section.addEventListener("pointermove", (e) => {
      const r = section.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.35);
      y((e.clientY - r.top - r.height / 2) * 0.35);
    });
    section.addEventListener("pointerleave", () => {
      x(0);
      y(0);
    });
  }
})();
