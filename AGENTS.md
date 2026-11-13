# AGENTS.md

Guide for coding agents working on this repository. Read it before you change anything.

## Project

Personal website of Ammar Nashar, https://ammarnashar.dev: a single page about him and his open-source tools
WinMedic (Windows repair tool, Rust), Sotto (meeting transcriber, Python) and MCperfBooster (Minecraft
performance tool, C#; called MCmodsLoader until October 2026).

Stack:

- Static HTML, CSS and vanilla JavaScript in `public/`. No framework, no bundler, no runtime dependencies.
- No libraries. The only script is `public/assets/js/main.js` (copy buttons, clock, live release numbers).
- `server.ts`: a small [Bun](https://bun.sh) server in TypeScript. It serves `public/` with security headers
  (strict CSP) and cache headers, fills the contact address and the project names and links into the pages
  and answers `/api/health` and `/api/projects` (name, link, latest release and commit count per project,
  fetched from GitHub and cached on the server, so visitors never talk to GitHub).
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
| After editing `main.css` or `main.js` | `./stamp-assets.sh` |
| Smoke test | `curl -fsS http://localhost:3000/api/health` |
| Deploy | on the server, in the project directory: `docker compose up -d --build` |

`public/` is mounted read-only into the container, so changes to HTML, CSS, JS and images are live as soon as
the files are on the server. Only `server.ts`, `Dockerfile` and `package.json` need the rebuild.
`stamp-assets.sh` sets the `?v=` hash behind the CSS and JS files, which are cached for a year. The favicon's
`?v=` in the `<head>` is bumped by hand.

## Layout

```
server.ts                Bun server: static files, headers, placeholders, /api/health, /api/projects
public/                  everything the browser gets, served as is
  index.html, 404.html   the page and the not-found page
  llms.txt               summary for LLMs and agents, served as text/plain
  robots.txt, sitemap.xml
  assets/css, assets/js  main.css, main.js (copy buttons, clock, live release numbers)
  assets/fonts           Big Shoulders Display, Hanken Grotesk, Geist Mono (third-party, see THIRD_PARTY_NOTICES.md)
  assets/img
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
   MCperfBooster are MIT.
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

- Project names and GitHub links are not written into `public/`. Use `{{<key>.name}}` and `{{<key>.url}}`
  (keys `winmedic`, `sotto`, `mcperfbooster`) in HTML and `.txt` files. `server.ts` looks the repositories
  up by ID (`GITHUB_REPOS`) and fills in the current name and link while serving, so a rename on GitHub
  reaches the page within about 30 minutes without a change here. The keys, element IDs and file names stay
  as they are after a rename, and so does the winget command (a package ID, not the repository name). By
  hand after a rename: `og.png` (the names are pixels) together with `og:image:alt` and its `?v=`, the
  start-up name in `GITHUB_REPOS`, `README.md` and these docs. The server log says when a name has changed.
  A new project needs its ID in `GITHUB_REPOS`:
  `curl -s https://api.github.com/repos/<owner>/<name> | grep -m1 '"id"'`.
- `.txt` files get the names but never the contact address: Cloudflare only hides addresses in HTML.
- Without a token GitHub allows 60 API requests per hour, and every answer counts, 304s and errors too. The
  server asks three times per project at most every 30 minutes. Only when GitHub answered none of them
  (network down, for example right after a reboot) it tries again after 10. Keep new requests rare.
- Strict CSP: no inline `<script>`, no `<style>` blocks or `style=""` attributes, no external URLs. Browsers
  block violations silently. Setting styles from `main.js` through the DOM is fine.
- The look is a poster: flat green (`--green`) and black, huge condensed capitals (Big Shoulders Display),
  hard edges, slightly crooked pictures with a solid shadow. Keep it that way: no gradients, glows, grain,
  rounded cards, custom cursors, counters or scroll effects. The only animation is the headline rising once
  on load. The design before November 2026 (dark with glows, GSAP animations) is the git tag `design-v1`.
- Sotto and MCperfBooster have no screenshots yet. Their pictures are built in HTML from
  real content: an example transcript (`.sheet-paper`) and the list of what gets installed (`.sheet-list`).
  When a real screenshot exists, replace the `<figure class="sheet …">` with an `<img class="shot">` like
  WinMedic's.
- The capitals come from CSS (`text-transform`), the HTML keeps normal spelling. Tests that read text should
  use `textContent`, not `innerText`.
- On the live site Cloudflare obfuscates e-mail addresses in the HTML and decodes them in the browser. Don't
  split or animate the address with JS. The copy button reads it from the `mailto:` link (`contactEmail()` in
  `main.js`).
- Without JavaScript the page is complete: it only loses the copy buttons, the clock and the live numbers.
  With "reduce motion" nothing moves. Keep it that way.
