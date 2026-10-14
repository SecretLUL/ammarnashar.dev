import { join, normalize } from "path";
import { stat } from "node:fs/promises";

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(import.meta.dir, "public");

// Latest releases for the project cards. Fetched here and cached, so visitors never talk to GitHub.
const GITHUB_OWNER = "SecretLUL";
const GITHUB_REPOS = ["WinMedic", "Sotto", "MCmodsLoader"];
const GITHUB_REFRESH_MS = 30 * 60 * 1000;
const GITHUB_RETRY_MS = 10 * 60 * 1000;

// The contact address is not in the repository: it comes from .env (see .env.example) and replaces
// every {{CONTACT_EMAIL}} in the HTML pages while they are served. Cloudflare's e-mail obfuscation
// then hides it in the delivered page, as with an address written into the HTML directly.
const CONTACT_EMAIL = process.env.CONTACT_EMAIL?.trim() || "you@example.com";
if (!process.env.CONTACT_EMAIL?.trim()) console.warn("[portfolio] CONTACT_EMAIL is not set, the page shows you@example.com");
const CONTACT_EMAIL_HTML = CONTACT_EMAIL.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

// Everything the page loads is self-hosted. Cloudflare's e-mail decoder is served from
// /cdn-cgi/ on this same origin, so 'self' covers it as well.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

// ---------------------------------------------------------------------------
// GitHub release cache
// ---------------------------------------------------------------------------
type RepoInfo = { version: string | null; published: string | null; commits: number | null; url: string };
type Cached = { etag: string; body: unknown; link: string | null };

let projects: { updated: string | null; repos: Record<string, RepoInfo> } = { updated: null, repos: {} };
let lastAttempt = 0;
let lastRefreshFailed = false;
let inflight: Promise<void> | null = null;
const etags = new Map<string, Cached>();

// Conditional requests: a 304 does not count against GitHub's rate limit (60/h without a token).
async function github(path: string): Promise<Cached> {
  const cached = etags.get(path);
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "ammarnashar.dev-portfolio",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(cached ? { "If-None-Match": cached.etag } : {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 304 && cached) return cached;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const entry: Cached = { etag: res.headers.get("etag") ?? "", body: await res.json(), link: res.headers.get("link") };
  if (entry.etag) etags.set(path, entry);
  return entry;
}

async function refreshProjects(): Promise<void> {
  lastAttempt = Date.now();
  const repos: Record<string, RepoInfo> = {};
  let failed = false;

  for (const name of GITHUB_REPOS) {
    const previous = projects.repos[name];
    const info: RepoInfo = {
      version: previous?.version ?? null,
      published: previous?.published ?? null,
      commits: previous?.commits ?? null,
      url: `https://github.com/${GITHUB_OWNER}/${name}`,
    };
    try {
      const release = (await github(`/repos/${GITHUB_OWNER}/${name}/releases/latest`)).body as {
        tag_name?: string;
        published_at?: string;
      };
      info.version = release.tag_name ?? info.version;
      info.published = release.published_at ?? info.published;
    } catch (err) {
      failed = true;
      console.warn(`[portfolio] latest release of ${name}: ${(err as Error).message}`);
    }
    try {
      // per_page=1 makes the page number of rel="last" equal to the number of commits
      const commits = await github(`/repos/${GITHUB_OWNER}/${name}/commits?per_page=1`);
      const last = commits.link?.match(/[?&]page=(\d+)>;\s*rel="last"/);
      info.commits = last ? Number(last[1]) : Array.isArray(commits.body) ? commits.body.length : info.commits;
    } catch (err) {
      failed = true;
      console.warn(`[portfolio] commit count of ${name}: ${(err as Error).message}`);
    }
    repos[name] = info;
  }

  lastRefreshFailed = failed;
  projects = { updated: new Date().toISOString(), repos };
}

function maybeRefresh(): void {
  if (inflight) return;
  const wait = lastRefreshFailed ? GITHUB_RETRY_MS : GITHUB_REFRESH_MS;
  if (lastAttempt && Date.now() - lastAttempt < wait) return;
  inflight = refreshProjects()
    .catch((err) => console.warn(`[portfolio] GitHub refresh failed: ${(err as Error).message}`))
    .finally(() => {
      inflight = null;
    });
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
// HTML is read on every request (it is small and sent with no-cache), so edits in public/ stay live at once.
async function htmlPage(filePath: string): Promise<string> {
  return (await Bun.file(filePath).text()).replaceAll("{{CONTACT_EMAIL}}", CONTACT_EMAIL_HTML);
}

async function serveFile(pathname: string, versioned: boolean): Promise<Response | null> {
  const relative = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(PUBLIC_DIR, relative));
  if (!filePath.startsWith(PUBLIC_DIR + "/")) return null;
  try {
    if (!(await stat(filePath)).isFile()) return null;
  } catch {
    return null;
  }
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  const cacheControl =
    ext === ".html"
      ? "no-cache"
      : versioned
        ? "public, max-age=31536000, immutable" // the ?v= value changes whenever the file does
        : "public, max-age=86400";
  return new Response(ext === ".html" ? await htmlPage(filePath) : Bun.file(filePath), {
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": cacheControl,
    },
  });
}

async function notFound(): Promise<Response> {
  const page = join(PUBLIC_DIR, "404.html");
  return new Response((await Bun.file(page).exists()) ? await htmlPage(page) : "Not found", {
    status: 404,
    headers: { ...SECURITY_HEADERS, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { ...SECURITY_HEADERS, Allow: "GET, HEAD" } });
    }
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === "/api/health") {
      return Response.json(
        {
          status: "ok",
          timestamp: new Date().toISOString(),
          runtime: `Bun ${Bun.version}`,
          uptime: Math.floor(process.uptime()),
        },
        { headers: SECURITY_HEADERS }
      );
    }

    if (pathname === "/api/projects") {
      maybeRefresh();
      // First request after a restart: wait briefly for the initial fetch
      if (!projects.updated && inflight) await Promise.race([inflight, Bun.sleep(4000)]);
      return Response.json(projects, { headers: { ...SECURITY_HEADERS, "Cache-Control": "public, max-age=600" } });
    }

    return (await serveFile(pathname, url.searchParams.has("v"))) ?? (await notFound());
  },
});

maybeRefresh();
console.log(`[portfolio] Bun server listening on http://0.0.0.0:${server.port}`);
