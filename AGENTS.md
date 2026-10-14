# AGENTS.md

Guide for coding agents working on this repository. Read it before you change anything.

## Project

Personal website of Ammar Nashar, https://ammarnashar.dev: a single page about him and his open-source tools
WinMedic (Windows repair tool, Rust), Sotto (meeting transcriber, Python) and MCmodsLoader (Minecraft
performance installer, C#).

Stack:

- Static HTML, CSS and vanilla JavaScript in `public/`. No framework, no bundler, no runtime dependencies.
- Animations with GSAP, ScrollTrigger and Lenis, self-hosted in `public/assets/vendor/`.
- `server.ts`: a small [Bun](https://bun.sh) server in TypeScript. It serves `public/` with security headers
  (strict CSP) and cache headers, fills the contact address into the HTML and answers `/api/health` and
  `/api/projects` (latest release and commit count per project, fetched from GitHub and cached on the server,
  so visitors never talk to GitHub).
- Docker image based on `oven/bun:alpine`, run with Docker Compose. In production a reverse proxy in front
  of the container handles HTTPS.

## Commands

| Task | Command |
| --- | --- |
| Install | Nothing is needed to run the site. `bun install` only adds editor types (`@types/bun`). |
| Configure | `cp .env.example .env`, then fill in the values |
| Run locally | `bun run dev` (restarts when `server.ts` changes) or `bun run start`, then http://localhost:3000 |
| Run in Docker | `docker compose up -d --build`, then http://127.0.0.1:3000 (address and port from `.env`) |
| Build | `docker compose build` |
| After editing `main.css`, `boot.js` or `main.js` | `./stamp-assets.sh` |
| Smoke test | `curl -fsS http://localhost:3000/api/health` |
| Deploy | on the server, in the project directory: `docker compose up -d --build` |

`public/` is mounted read-only into the container, so changes to HTML, CSS, JS and images are live as soon as
the files are on the server. Only `server.ts`, `Dockerfile` and `package.json` need the rebuild.
`stamp-assets.sh` sets the `?v=` hash behind the CSS and JS files, which are cached for a year. The favicon's
`?v=` in the `<head>` is bumped by hand.

## Layout

```
server.ts                Bun server: static files, headers, contact address, /api/health, /api/projects
public/                  everything the browser gets, served as is
  index.html, 404.html   the page and the not-found page
  llms.txt               summary for LLMs and agents, served as text/plain
  robots.txt, sitemap.xml
  assets/css, assets/js  main.css, boot.js (runs before the first paint), main.js (interactions, motion)
  assets/vendor          GSAP, ScrollTrigger, Lenis (third-party, see THIRD_PARTY_NOTICES.md)
  assets/fonts, assets/img
stamp-assets.sh          cache-busting hashes for CSS and JS
Dockerfile, docker-compose.yaml, .env.example
```

## Rules that must never be broken

1. Never commit secrets, credentials or real server details (IP addresses, host names, ports, paths, user
   names). Real values go into `.env`, which is git-ignored, with a placeholder in `.env.example`. The contact
   address stays out of the repository too: keep the `{{CONTACT_EMAIL}}` placeholders in the HTML,
   `server.ts` fills them in from `.env`.
2. No trackers, analytics or third-party scripts, and nothing loaded from other servers (CDNs, Google Fonts,
   embeds). Everything is self-hosted; the CSP in `server.ts` only allows `'self'`.
3. License information must be correct everywhere (page, `llms.txt`, docs): WinMedic is GPL-3.0, Sotto and
   MCmodsLoader are MIT.
4. When the projects on the page change (added, removed, renamed, new facts), update `public/llms.txt` in the
   same change.
5. Every image needs a meaningful alt text. `alt=""` is only for pure decoration or for an image that repeats
   the text right next to it (a project logo beside the project name), so screen readers don't read it twice.
6. After every change the build must pass (`docker compose build`) and the page must load without errors in
   the browser console.
7. No AI attribution: never credit Claude, or any other AI tool, as author or co-author of commits, pull
   requests or files. No `Co-Authored-By: Claude …` trailers, no "Generated with Claude Code" lines, no
   session links.

## Good to know

- Strict CSP: no inline `<script>`, no `<style>` blocks or `style=""` attributes, no external URLs. Browsers
  block violations silently. Setting styles from `main.js` through the DOM is fine.
- The hero headline exists twice: an `.sr-only` sentence (the real text for screen readers, agents and search
  engines) and an animated copy that is `aria-hidden` and gets its words from `data-text` through CSS. Change
  both together.
- On the live site Cloudflare obfuscates e-mail addresses in the HTML and decodes them in the browser. Don't
  split or animate the address with JS. The copy button reads it from the `mailto:` link (`contactEmail()` in
  `main.js`).
- Hero dot grid (`setupCanvas()` in `main.js`): no CSS mask and no opacity transition on the canvas. Together
  they made Firefox stutter for seconds after every page load, so the fade is computed per dot.
- Without JavaScript or with "reduce motion" the page stays static and fully usable. Keep it that way.
