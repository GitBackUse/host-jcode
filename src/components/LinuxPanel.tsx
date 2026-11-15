import { useEffect, useRef, useState } from "react";
import { Loader2, Play, Power, Upload, ExternalLink, ChevronUp, ChevronDown, Cpu, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectFile } from "@/lib/gemini";

const API = "https://api.github.com";
const K = { tok: "jcode.ghToken", repo: "jcode.ghRepo" };
type CS = { name: string; state: string; web_url: string };
export type LinuxJob = { id: number; files: ProjectFile[]; commands: string[] };

/** Bottom drawer: wakes the user's GitHub Codespace and runs work there through the bridge on port 8787. */
export function LinuxPanel({ files, job, onLinux }: { files: ProjectFile[]; job: LinuxJob | null; onLinux: (info: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [tok, setTok] = useState("");
  const [repo, setRepo] = useState("GitBackUse/host-jcode");
  const [cs, setCs] = useState<CS | null>(null);
  const [status, setStatus] = useState("Linux machine not connected");
  const [busyConn, setBusyConn] = useState(false);
  const [needAuth, setNeedAuth] = useState(false);
  const [ready, setReady] = useState(false);
  const [cmd, setCmd] = useState("");
  const [out, setOut] = useState("");
  const [running, setRunning] = useState(false);
  const outRef = useRef<HTMLPreElement>(null);
  const lastJob = useRef(0);
  const bridge = cs ? `https://${cs.name}-8787.app.github.dev` : "";

  useEffect(() => {
    const t = localStorage.getItem(K.tok) ?? ""; const r = localStorage.getItem(K.repo) ?? "GitBackUse/host-jcode";
    setTok(t); setRepo(r); if (t) void connect(t, r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { outRef.current?.scrollTo(0, 1e9); }, [out]);
  useEffect(() => {
    if (!job || job.id === lastJob.current || !ready) return;
    lastJob.current = job.id; setOpen(true);
    void (async () => { await sync(job.files, true); for (const c of job.commands) await run(c); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, ready]);

  const gh = (t: string, p: string, init?: RequestInit) =>
    fetch(API + p, { ...init, headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json", ...(init?.headers ?? {}) } });
  const auth = () => ({ Authorization: `Bearer ${tok || localStorage.getItem(K.tok)}`, "Content-Type": "application/json" });

  async function connect(t = tok, r = repo) {
    if (!t.trim()) { setOpen(true); return; }
    localStorage.setItem(K.tok, t.trim()); localStorage.setItem(K.repo, r.trim());
    setBusyConn(true); setNeedAuth(false);
    try {
      setStatus("Finding your machine…");
      const list = await gh(t, `/repos/${r}/codespaces`);
      if (list.status === 401) throw new Error("GitHub rejected the token. Make a new one with the codespace and repo permissions.");
      if (!list.ok) throw new Error(`GitHub said ${list.status}. The token needs the "codespace" and "repo" permissions.`);
      let c: CS | undefined = (await list.json()).codespaces?.[0];
      if (!c) {
        setStatus("Creating your machine (3–5 minutes the first time)…");
        const res = await gh(t, `/repos/${r}/codespaces`, { method: "POST", body: JSON.stringify({ idle_timeout_minutes: 30 }) });
        if (!res.ok) throw new Error(`Could not create the machine (${res.status}): ${(await res.text()).slice(0, 160)}`);
        c = await res.json();
      }
      if (c!.state !== "Available" && c!.state !== "Starting") { setStatus("Waking up your machine (about 1 minute)…"); await gh(t, `/user/codespaces/${c!.name}/start`, { method: "POST" }); }
      for (let i = 0; i < 120; i++) {
        const s: CS = await (await gh(t, `/user/codespaces/${c!.name}`)).json();
        setCs(s);
        if (s.state === "Available") {
          try {
            const p = await fetch(`https://${s.name}-8787.app.github.dev/info`, { headers: { Authorization: `Bearer ${t}` } });
            if (p.ok) {
              const info = await p.json().catch(() => ({}));
              const txt = [info.node && `Node ${info.node}`, info.py, info.rust, info.go, info.jcode ? "jcode CLI installed" : ""].filter(Boolean).join(", ");
              setReady(true); setStatus("Linux machine connected · AI now builds full projects here"); onLinux(txt);
              toast.success("Linux machine connected"); return;
            }
          } catch { if (i > 6) setNeedAuth(true); }
          setStatus("Machine is on, starting the runner…");
        } else setStatus(`Machine is ${s.state.toLowerCase()}…`);
        await new Promise((ok) => setTimeout(ok, 5000));
      }
      throw new Error("Timed out waiting for the machine. Try Connect again.");
    } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); setOpen(true); }
    finally { setBusyConn(false); }
  }

  async function sync(fs = files, quiet = false) {
    try {
      const r = await fetch(`${bridge}/files`, { method: "POST", headers: auth(), body: JSON.stringify({ files: fs }) });
      if (!r.ok) throw new Error(String(r.status));
      setOut((o) => o + `\n▸ ${fs.length} files written to the machine\n`);
      if (!quiet) toast.success("Files sent to the machine");
    } catch { toast.error("Could not send files"); }
  }

  async function run(c = cmd) {
    if (!c.trim()) return;
    setRunning(true); setOut((o) => o + `\n$ ${c}\n`);
    try {
      const r = await fetch(`${bridge}/run`, { method: "POST", headers: auth(), body: JSON.stringify({ cmd: c }) });
      const rd = r.body!.getReader(); const dec = new TextDecoder();
      for (;;) { const { done, value } = await rd.read(); if (done) break; setOut((o) => o + dec.decode(value)); }
    } catch (e) { setOut((o) => o + `\n[error] ${e instanceof Error ? e.message : e}\n`); }
    setRunning(false); setCmd("");
  }

  async function stop() {
    if (!cs) return;
    await gh(tok, `/user/codespaces/${cs.name}/stop`, { method: "POST" });
    setReady(false); onLinux(null); setStatus("Machine stopped · saving your free hours");
  }

  const dot = ready ? "bg-primary shadow-[0_0_8px_var(--primary)]" : busyConn ? "bg-accent animate-pulse" : "bg-muted-foreground";

  return (
    <div className="shrink-0 border-t border-border glass">
      <button onClick={() => setOpen((o) => !o)} className="flex h-9 w-full items-center gap-2 px-3 text-xs">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <Cpu className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">Linux</span>
        <span className="truncate text-muted-foreground">{busyConn && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}{status}</span>
        <span className="flex-1" />
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      {open && (!ready ? (
        <div className="mx-auto flex max-w-xl flex-col gap-2 p-4 pt-1">
          <p className="text-xs text-muted-foreground">Paste a GitHub token once (permissions: <b>codespace</b> and <b>repo</b>, no expiration). It stays saved in this browser and connects automatically every time you open the page.</p>
          <div className="flex gap-2">
            <Input type="password" placeholder="ghp_..." value={tok} onChange={(e) => setTok(e.target.value)} className="font-mono" />
            <Button onClick={() => connect()} disabled={!tok.trim() || busyConn} className="bg-brand text-primary-foreground">{busyConn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}</Button>
          </div>
          <Input value={repo} onChange={(e) => setRepo(e.target.value)} className="font-mono text-xs" />
          {needAuth && cs && (
            <div className="rounded-lg border border-accent p-3 text-xs">
              <p className="mb-2 flex items-center gap-1.5 font-medium"><ShieldCheck className="h-3.5 w-3.5" />GitHub is blocking the machine's door</p>
              <p className="mb-2 text-muted-foreground">Open your machine once and run this in its terminal, then wait here: <code className="font-mono">gh codespace ports visibility 8787:public -c $CODESPACE_NAME</code></p>
              <Button size="sm" variant="outline" asChild><a href={cs.web_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />Open machine</a></Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-[38vh] flex-col gap-2 p-3 pt-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Button size="sm" variant="outline" onClick={() => sync()}><Upload className="h-3.5 w-3.5" />Send files</Button>
            {["npm install", "npx -y serve -l 3000 .", "python3 main.py", "cargo run", "go run .", "git status"].map((q) => (
              <Button key={q} size="sm" variant="ghost" className="font-mono text-xs" disabled={running} onClick={() => run(q)}>{q}</Button>
            ))}
            <span className="flex-1" />
            <Button size="sm" variant="ghost" asChild><a href={`https://${cs!.name}-7681.app.github.dev`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />jcode terminal</a></Button>
            <Button size="sm" variant="ghost" asChild><a href={`https://${cs!.name}-3000.app.github.dev`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />App :3000</a></Button>
            <Button size="sm" variant="ghost" onClick={stop}><Power className="h-3.5 w-3.5" />Stop</Button>
          </div>
          <pre ref={outRef} className="flex-1 overflow-auto rounded-xl border border-border bg-background/80 p-3 font-mono text-xs whitespace-pre-wrap">{out || "When the AI builds something, its files and commands run here automatically."}</pre>
          <div className="flex gap-2">
            <Input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !running && run()} placeholder="Any Linux command, e.g. jcode --help" className="font-mono" />
            <Button onClick={() => run()} disabled={running} className="bg-brand text-primary-foreground">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
