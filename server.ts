import { join, normalize } from "path";
import { stat } from "node:fs/promises";

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(import.meta.dir, "public");

// Name, link, latest release and commit count of each project. Fetched here and cached, so visitors
// never talk to GitHub. The repositories are looked up by ID, which stays the same when one is renamed
// or moves to another account, so the pages always show the current name: it replaces {{<key>.name}}
// and {{<key>.url}} while they are served (see fillPage). The key is fixed and never shown; the name
// here is only used until GitHub has answered once after a start.
const GITHUB_OWNER = "SecretLUL";
const GITHUB_REPOS = [
  { key: "winmedic", id: 1334302961, name: "WinMedic" },
  { key: "sotto", id: 1329749976, name: "Sotto" },
  { key: "mcperfbooster", id: 1360339604, name: "MCperfBooster" },
];
const GITHUB_REFRESH_MS = 30 * 60 * 1000;
const GITHUB_RETRY_MS = 10 * 60 * 1000; // only when GitHub answered no request, see answers

// The contact address is not in the repository: it comes from .env (see .env.example) and replaces
// every {{CONTACT_EMAIL}} in the HTML pages while they are served. Cloudflare's e-mail obfuscation
// then hides it in the delivered page, as with an address written into the HTML directly.
const CONTACT_EMAIL = process.env.CONTACT_EMAIL?.trim() || "you@example.com";
if (!process.env.CONTACT_EMAIL?.trim()) console.warn("[portfolio] CONTACT_EMAIL is not set, the page shows you@example.com");
const CONTACT_EMAIL_HTML = escapeHtml(CONTACT_EMAIL);

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
// GitHub cache
// ---------------------------------------------------------------------------
type RepoInfo = { name: string; url: string; version: string | null; published: string | null; commits: number | null };
type Cached = { etag: string; body: unknown; link: string | null };

// Account and repository names on GitHub only contain letters, digits, "-", "_" and "."
const REPO_URL = /^https:\/\/github\.com\/[\w.-]+\/([\w.-]+)$/;

let projects: { updated: string | null; repos: Record<string, RepoInfo> } = {
  updated: null,
  repos: Object.fromEntries(
    GITHUB_REPOS.map((repo) => [
      repo.key,
      { name: repo.name, url: `https://github.com/${GITHUB_OWNER}/${repo.name}`, version: null, published: null, commits: null },
    ])
  ),
};
let lastAttempt = 0;
let lastRefreshUnanswered = false;
let answers = 0; // answers from GitHub during the current refresh
let inflight: Promise<void> | null = null;
const etags = new Map<string, Cached>();

// Conditional requests: GitHub answers 304 without a body when nothing has changed. Without a token every
// answer counts against the limit of 60 requests per hour and IP address, error answers and 304s included
// (tested 10/2026), and other services share that address. So a refresh is only repeated sooner
// (GITHUB_RETRY_MS) when GitHub did not answer a single request.
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
  answers++;
  if (res.status === 304 && cached) return cached;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const entry: Cached = { etag: res.headers.get("etag") ?? "", body: await res.json(), link: res.headers.get("link") };
  if (entry.etag) etags.set(path, entry);
  return entry;
}

async function refreshProjects(): Promise<void> {
  lastAttempt = Date.now();
  const repos: Record<string, RepoInfo> = {};
  answers = 0;

  for (const repo of GITHUB_REPOS) {
    // On errors the values from the last refresh stay
    const info: RepoInfo = { ...projects.repos[repo.key] };
    const base = `/repositories/${repo.id}`;
    try {
      const current = (await github(base)).body as { name?: unknown; html_url?: unknown };
      const url = typeof current.html_url === "string" ? current.html_url : "";
      const name = url.match(REPO_URL)?.[1];
      if (!name || name !== current.name) throw new Error("unexpected name or link");
      if (name !== info.name) {
        console.warn(`[portfolio] ${info.name} is now called ${name} on GitHub: the pages use the new name, og.png and GITHUB_REPOS don't`);
      }
      info.name = name;
      info.url = url;
    } catch (err) {
      console.warn(`[portfolio] name of ${info.name}: ${(err as Error).message}`);
    }
    try {
      const release = (await github(`${base}/releases/latest`)).body as { tag_name?: string; published_at?: string };
      info.version = release.tag_name ?? info.version;
      info.published = release.published_at ?? info.published;
    } catch (err) {
      console.warn(`[portfolio] latest release of ${info.name}: ${(err as Error).message}`);
    }
    try {
      // per_page=1 makes the page number of rel="last" equal to the number of commits
      const commits = await github(`${base}/commits?per_page=1`);
      const last = commits.link?.match(/[?&]page=(\d+)>;\s*rel="last"/);
      info.commits = last ? Number(last[1]) : Array.isArray(commits.body) ? commits.body.length : info.commits;
    } catch (err) {
      console.warn(`[portfolio] commit count of ${info.name}: ${(err as Error).message}`);
    }
    repos[repo.key] = info;
  }

  lastRefreshUnanswered = answers === 0;
  projects = { updated: new Date().toISOString(), repos };
}

function maybeRefresh(): void {
  if (inflight) return;
  const wait = lastRefreshUnanswered ? GITHUB_RETRY_MS : GITHUB_REFRESH_MS;
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
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// HTML and text files are read on every request (they are small and sent with no-cache), so edits in
// public/ and new names from GitHub are live at once. Both get the project names and links
// ({{winmedic.name}}, {{winmedic.url}}, ...). Only HTML gets the contact address: Cloudflare hides
// addresses in HTML, but not in plain text.
async function fillPage(filePath: string, html: boolean): Promise<string> {
  let text = await Bun.file(filePath).text();
  if (html) text = text.replaceAll("{{CONTACT_EMAIL}}", CONTACT_EMAIL_HTML);
  return text.replace(/\{\{([\w-]+)\.(name|url)\}\}/g, (placeholder, key: string, field: "name" | "url") => {
    if (!Object.hasOwn(projects.repos, key)) return placeholder;
    const value = projects.repos[key][field];
    return html ? escapeHtml(value) : value;
  });
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
  const filled = ext === ".html" || ext === ".txt";
  const cacheControl = filled
    ? "no-cache"
    : versioned
      ? "public, max-age=31536000, immutable" // the ?v= value changes whenever the file does
      : "public, max-age=86400";
  return new Response(filled ? await fillPage(filePath, ext === ".html") : Bun.file(filePath), {
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": cacheControl,
    },
  });
}

async function notFound(): Promise<Response> {
  const page = join(PUBLIC_DIR, "404.html");
  return new Response((await Bun.file(page).exists()) ? await fillPage(page, true) : "Not found", {
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

    // The pages need the project names, /api/projects the rest
    maybeRefresh();

    if (pathname === "/api/projects") {
      // First request after a restart: wait briefly for the initial fetch
      if (!projects.updated && inflight) await Promise.race([inflight, Bun.sleep(4000)]);
      return Response.json(projects, { headers: { ...SECURITY_HEADERS, "Cache-Control": "public, max-age=600" } });
    }

    return (await serveFile(pathname, url.searchParams.has("v"))) ?? (await notFound());
  },
});

maybeRefresh();
console.log(`[portfolio] Bun server listening on http://0.0.0.0:${server.port}`);
