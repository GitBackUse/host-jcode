// Runner bridge on port 8787: lets the JCode Studio web page run commands and write files here.
// Every request must carry the owner's GitHub token; it is checked against GitHub.
import http from "node:http"; import { spawn } from "node:child_process";
import fs from "node:fs/promises"; import path from "node:path";
import { browse } from "./steel.mjs";
const ROOT = path.resolve(process.env.CODESPACE_VSCODE_FOLDER || process.cwd(), "workspace");
const OWNER = process.env.GITHUB_USER; const ok = new Map();
async function auth(req) {
  const t = (req.headers.authorization || "").replace(/^Bearer /, ""); if (!t) return false;
  if (!OWNER) return false;
  if ((ok.get(t) || 0) > Date.now()) return true;
  const r = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) return false; const u = await r.json();
  if (u.login !== OWNER) return false; ok.set(t, Date.now() + 60000); return true;
}
const body = (req) => new Promise((res) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { res(d ? JSON.parse(d) : {}); } catch { res({}); } }); });
http.createServer(async (req, res) => { try {
  res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "authorization,content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.end();
  if (!(await auth(req))) { res.statusCode = 401; return res.end("unauthorized"); }
  await fs.mkdir(ROOT, { recursive: true });
  if (req.url === "/health") return res.end("ok");
  if (req.url === "/info") {
    const v = (c) => new Promise((r) => { const p = spawn("bash", ["-lc", c]); let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => r(o.trim())); });
    const [node, py, rust, go, jc] = await Promise.all(["node -v", "python3 --version", "rustc --version", "go version", "command -v jcode && jcode --version 2>/dev/null | head -1"].map(v));
    res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ node, py, rust, go, jcode: jc, steel: !!process.env.STEEL_API_KEY, root: ROOT }));
  }
  if (req.url === "/files" && req.method === "POST") {
    const { files = [] } = await body(req);
    if (!Array.isArray(files)) { res.statusCode = 400; return res.end("Invalid file list"); }
    for (const f of files) {
      if (typeof f?.path !== "string" || typeof f?.content !== "string") { res.statusCode = 400; return res.end("Invalid file"); }
      const p = path.resolve(ROOT, f.path);
      if (!p.startsWith(ROOT + path.sep) || f.path.split(/[\\/]/).includes(".git")) { res.statusCode = 400; return res.end("Unsafe file path"); }
      await fs.mkdir(path.dirname(p), { recursive: true });
      const parent = await fs.realpath(path.dirname(p));
      if (parent !== ROOT && !parent.startsWith(ROOT + path.sep)) { res.statusCode = 400; return res.end("Unsafe file directory"); }
      const stat = await fs.lstat(p).catch(() => null);
      if (stat?.isSymbolicLink()) { res.statusCode = 400; return res.end("Symbolic links cannot be overwritten"); }
      await fs.writeFile(p, f.content);
    }
    return res.end("ok");
  }
  if (req.url === "/browse" && req.method === "POST") {
    const { url } = await body(req);
    res.setHeader("Content-Type", "application/json");
    try { return res.end(JSON.stringify(await browse(String(url || "")))); }
    catch (e) { res.statusCode = 502; return res.end(JSON.stringify({ error: String(e.message || e) })); }
  }
  if (req.url === "/run" && req.method === "POST") {
    const { cmd } = await body(req);
    if (typeof cmd !== "string" || !cmd.trim()) { res.statusCode = 400; return res.end("Invalid command"); }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    const p = spawn("bash", ["-lc", cmd], { cwd: ROOT, env: process.env });
    p.stdout.on("data", (d) => res.write(d)); p.stderr.on("data", (d) => res.write(d));
    p.on("error", (e) => res.end(`\n[error] ${e.message}\n[exit 1]\n`));
    p.on("close", (c) => { if (!res.writableEnded) res.end(`\n[exit ${c ?? 1}]\n`); });
    res.on("close", () => { if (!res.writableEnded) p.kill(); }); return;
  }
  res.statusCode = 404; res.end();
  } catch (e) { res.statusCode = 500; res.end(String(e)); }
}).listen(8787, () => console.log("bridge on 8787"));
