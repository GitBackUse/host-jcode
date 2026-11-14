// Runner bridge on port 8787: lets the JCode Studio web page run commands and write files here.
// Every request must carry the owner's GitHub token; it is checked against GitHub.
import http from "node:http"; import { spawn } from "node:child_process";
import fs from "node:fs/promises"; import path from "node:path";
const ROOT = path.resolve(process.env.CODESPACE_VSCODE_FOLDER || process.cwd(), "workspace");
const OWNER = process.env.GITHUB_USER; const ok = new Map();
async function auth(req) {
  const t = (req.headers.authorization || "").replace(/^Bearer /, ""); if (!t) return false;
  if (ok.has(t)) return true;
  const r = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) return false; const u = await r.json();
  if (OWNER && u.login !== OWNER) return false; ok.set(t, 1); return true;
}
const body = (req) => new Promise((res) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => res(d ? JSON.parse(d) : {})); });
http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "authorization,content-type");
  if (req.method === "OPTIONS") return res.end();
  if (!(await auth(req))) { res.statusCode = 401; return res.end("unauthorized"); }
  await fs.mkdir(ROOT, { recursive: true });
  if (req.url === "/health") return res.end("ok");
  if (req.url === "/files" && req.method === "POST") {
    const { files = [] } = await body(req);
    for (const f of files) { const p = path.resolve(ROOT, f.path); if (!p.startsWith(ROOT)) continue; await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, f.content); }
    return res.end("ok");
  }
  if (req.url === "/run" && req.method === "POST") {
    const { cmd } = await body(req);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    const p = spawn("bash", ["-lc", cmd], { cwd: ROOT, env: process.env });
    p.stdout.on("data", (d) => res.write(d)); p.stderr.on("data", (d) => res.write(d));
    p.on("close", (c) => res.end(`\n[exit ${c}]\n`)); req.on("close", () => p.kill()); return;
  }
  res.statusCode = 404; res.end();
}).listen(8787, () => console.log("bridge on 8787"));
