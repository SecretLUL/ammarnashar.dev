# ammarnashar.dev

Source code of my personal website, [ammarnashar.dev](https://ammarnashar.dev): one page about me and my
open-source tools [WinMedic](https://github.com/SecretLUL/WinMedic), [Sotto](https://github.com/SecretLUL/Sotto)
and [MCmodsLoader](https://github.com/SecretLUL/MCmodsLoader).

Plain HTML, CSS and JavaScript, served by a small [Bun](https://bun.sh) server. No framework, no build step,
no trackers, everything self-hosted.

## Run it locally

With Bun:

```sh
cp .env.example .env   # set CONTACT_EMAIL, Bun reads .env on its own
bun run dev            # http://localhost:3000
```

Or with Docker:

```sh
cp .env.example .env
docker compose up -d --build   # http://127.0.0.1:3000
```

## License

- **Code** (HTML, CSS, JavaScript, TypeScript, scripts and config): [MIT](LICENSE).
- **Content** (texts, images, logos, screenshots, the social preview image): © 2026 Ammar Nashar, all rights
  reserved. Learn from the code or build your own site with it, but please bring your own content.
- **Third-party files** (GSAP, Lenis, fonts, brand icons) keep their own licenses, see
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
