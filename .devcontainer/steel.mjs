#!/usr/bin/env node
// Steel.dev headless browser helper. Key comes from the STEEL_API_KEY Codespaces secret (never stored in files).
// CLI: steel <url>  -> prints page text + screenshot link.  Also imported by bridge.mjs for /browse.
const API = "https://api.steel.dev/v1";
let projectId = process.env.STEEL_PROJECT_ID || "";
async function project(key) {
  if (projectId) return projectId;
  const r = await fetch(`${API}/projects`, { headers: { "steel-api-key": key } });
  const d = await r.json().catch(() => ({}));
  const p = (d.projects || []).find((x) => x.isDefault) || (d.projects || [])[0];
  return (projectId = p?.id || "");
}
export async function browse(url) {
  const key = process.env.STEEL_API_KEY;
  if (!key) throw new Error("STEEL_API_KEY is not set on this machine");
  if (!/^https?:\/\//.test(url)) url = "https://" + url;
  const body = { url, format: ["markdown"], screenshot: true };
  const pid = await project(key); if (pid) body.projectId = pid;
  const r = await fetch(`${API}/scrape`, { method: "POST", headers: { "steel-api-key": key, "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(`Steel ${r.status}: ${d.message || d.error || "failed"}`);
  return { url, title: d.metadata?.title || "", markdown: d.content?.markdown || "", screenshot: d.screenshot?.url || "" };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const u = process.argv[2]; if (!u) { console.log("usage: steel <url>"); process.exit(1); }
  browse(u).then((p) => { console.log(`# ${p.title}\n${p.url}\nscreenshot: ${p.screenshot}\n\n${p.markdown.slice(0, 8000)}`); })
    .catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
