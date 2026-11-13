/* ammarnashar.dev: the few things that need JavaScript.
   Copy buttons, the clock in the contact section, the year in the footer and the live release
   numbers. Without this file the page is complete and readable, it just shows the values
   written into the HTML. */
(() => {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  setupYear();
  setupClock();
  setupCopy();
  setupLiveData();

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
        if (el && total >= 10) el.textContent = String(Math.floor(total / 10) * 10); // shown as "430+"
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
})();
