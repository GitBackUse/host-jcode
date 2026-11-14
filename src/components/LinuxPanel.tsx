import { useEffect, useRef, useState } from "react";
import { Loader2, Play, Power, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectFile } from "@/lib/gemini";

const API = "https://api.github.com";
const K = { tok: "jcode.ghToken", repo: "jcode.ghRepo" };
type CS = { name: string; state: string; web_url: string };

/** Runs commands on the user's own GitHub Codespace through the bridge on port 8787. */
export function LinuxPanel({ files }: { files: ProjectFile[] }) {
  const [tok, setTok] = useState("");
  const [repo, setRepo] = useState("GitBackUse/host-jcode");
  const [cs, setCs] = useState<CS | null>(null);
  const [status, setStatus] = useState("Not connected");
  const [ready, setReady] = useState(false);
  const [cmd, setCmd] = useState("");
  const [out, setOut] = useState("");
  const [running, setRunning] = useState(false);
  const outRef = useRef<HTMLPreElement>(null);
  const bridge = cs ? `https://${cs.name}-8787.app.github.dev` : "";

  useEffect(() => {
    const t = localStorage.getItem(K.tok) ?? ""; const r = localStorage.getItem(K.repo) ?? "GitBackUse/host-jcode";
    setTok(t); setRepo(r); if (t) void connect(t, r);
  }, []);
  useEffect(() => { outRef.current?.scrollTo(0, 1e9); }, [out]);

  const gh = (t: string, path: string, init?: RequestInit) =>
    fetch(API + path, { ...init, headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json", ...(init?.headers ?? {}) } });

  async function connect(t = tok, r = repo) {
    localStorage.setItem(K.tok, t); localStorage.setItem(K.repo, r);
    try {
      setStatus("Finding your machine…");
      const list = await gh(t, `/repos/${r}/codespaces`);
      if (!list.ok) throw new Error(`GitHub said ${list.status}. Check the token has "codespace" and "repo" permissions.`);
      let c: CS | undefined = (await list.json()).codespaces?.[0];
      if (!c) {
        setStatus("Creating your machine (about 3 minutes the first time)…");
        const res = await gh(t, `/repos/${r}/codespaces`, { method: "POST", body: JSON.stringify({ idle_timeout_minutes: 30 }) });
        if (!res.ok) throw new Error(`Could not create machine (${res.status})`);
        c = await res.json();
      }
      if (c!.state !== "Available") { setStatus("Waking up your machine…"); await gh(t, `/user/codespaces/${c!.name}/start`, { method: "POST" }); }
      for (let i = 0; i < 90; i++) {
        const s: CS = await (await gh(t, `/user/codespaces/${c!.name}`)).json();
        setCs(s);
        if (s.state === "Available") {
          try { const p = await fetch(`https://${s.name}-8787.app.github.dev/health`, { headers: { Authorization: `Bearer ${t}` } }); if (p.ok) { setReady(true); setStatus("Connected · Linux machine ready"); return; } } catch { /* booting */ }
          setStatus("Machine on, starting the runner…");
        } else setStatus(`Machine is ${s.state.toLowerCase()}…`);
        await new Promise((ok) => setTimeout(ok, 5000));
      }
      throw new Error("Timed out waiting for the machine");
    } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
  }

  async function sync() {
    const r = await fetch(`${bridge}/files`, { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ files }) });
    r.ok ? toast.success(`${files.length} files sent to the machine (folder: workspace)`) : toast.error("Could not send files");
  }

  async function run(c = cmd) {
    if (!c.trim() || running) return;
    setRunning(true); setOut((o) => o + `\n$ ${c}\n`);
    try {
      const r = await fetch(`${bridge}/run`, { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ cmd: c }) });
      const rd = r.body!.getReader(); const dec = new TextDecoder();
      for (;;) { const { done, value } = await rd.read(); if (done) break; setOut((o) => o + dec.decode(value)); }
    } catch (e) { setOut((o) => o + `\n[error] ${e instanceof Error ? e.message : e}\n`); }
    setRunning(false); setCmd("");
  }

  async function stop() { if (cs) { await gh(tok, `/user/codespaces/${cs.name}/stop`, { method: "POST" }); setReady(false); setStatus("Machine stopped · saving your free hours"); } }

  if (!ready) return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 p-6">
      <h2 className="text-lg font-semibold">Real Linux + jcode</h2>
      <p className="text-sm text-muted-foreground">Paste a GitHub token once (permissions: codespace, repo). It stays saved in this browser and connects automatically next time.</p>
      <Input type="password" placeholder="ghp_..." value={tok} onChange={(e) => setTok(e.target.value)} className="font-mono" />
      <Input value={repo} onChange={(e) => setRepo(e.target.value)} className="font-mono" />
      <Button onClick={() => connect()} disabled={!tok.trim()} className="bg-brand text-primary-foreground">Connect</Button>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">{status.endsWith("…") && <Loader2 className="h-3 w-3 animate-spin" />}{status}</p>
    </div>
  );

  return (
    <div className="flex min-h-[50vh] flex-1 flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-primary px-2 py-0.5 text-primary">{status}</span>
        <Button size="sm" variant="outline" onClick={sync}><Upload className="h-3.5 w-3.5" />Send files</Button>
        {["npm install", "npx serve -l 3000 .", "python3 main.py", "cargo run", "go run .", "git status"].map((q) => (
          <Button key={q} size="sm" variant="ghost" className="font-mono text-xs" onClick={() => run(q)}>{q}</Button>
        ))}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" asChild><a href={`https://${cs!.name}-7681.app.github.dev`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />jcode terminal</a></Button>
        <Button size="sm" variant="ghost" asChild><a href={`https://${cs!.name}-3000.app.github.dev`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />App on :3000</a></Button>
        <Button size="sm" variant="ghost" onClick={stop}><Power className="h-3.5 w-3.5" />Stop</Button>
      </div>
      <pre ref={outRef} className="flex-1 overflow-auto rounded-xl border border-border bg-background/80 p-3 font-mono text-xs whitespace-pre-wrap">{out || "Output from your Linux machine appears here. Files run inside the workspace folder."}</pre>
      <div className="flex gap-2">
        <Input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Any Linux command, e.g. jcode --help" className="font-mono" />
        <Button onClick={() => run()} disabled={running} className="bg-brand text-primary-foreground">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}</Button>
      </div>
    </div>
  );
}
