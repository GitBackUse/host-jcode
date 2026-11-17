import { useEffect, useRef, useState } from "react";
import { Loader2, Play, Power, Upload, ExternalLink, ChevronUp, ChevronDown, Cpu, ShieldCheck, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectFile } from "@/lib/gemini";
import { executeLinuxJob } from "@/lib/linux-jobs";

const API = "https://api.github.com";
const K = { tok: "jcode.ghToken", repo: "jcode.ghRepo" };
type CS = { name: string; state: string; web_url: string };
export type LinuxJob = { id: number; files: ProjectFile[]; commands: string[] };

/** Bottom drawer: wakes the user's GitHub Codespace and runs work there through the bridge on port 8787. */
export function LinuxPanel({ files, job, onLinux, onJobDone }: { files: ProjectFile[]; job: LinuxJob | null; onLinux: (info: string | null, previewUrl?: string) => void; onJobDone?: (log: string) => void }) {
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
  const [shot, setShot] = useState("");
  const outRef = useRef<HTMLPreElement>(null);
  const lastJob = useRef(0);
  const connecting = useRef(false);
  const working = useRef(false);
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
    working.current = true; setRunning(true);
    void executeLinuxJob(job, (fs) => sync(fs, true), (c) => run(c, true)).then((log) => {
      working.current = false; setRunning(false); onJobDone?.(log);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, ready]);

  const gh = (t: string, p: string, init?: RequestInit) =>
    fetch(API + p, { ...init, headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json", ...(init?.headers ?? {}) } });
  const auth = () => ({ Authorization: `Bearer ${tok || localStorage.getItem(K.tok)}`, "Content-Type": "application/json" });

  async function connect(t = tok, r = repo) {
    if (connecting.current) return;
    if (!t.trim()) { setOpen(true); return; }
    t = t.trim(); r = r.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(r)) { setStatus("Enter a repository as owner/name"); return; }
    localStorage.setItem(K.tok, t.trim()); localStorage.setItem(K.repo, r.trim());
    connecting.current = true; setReady(false); onLinux(null);
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
      if (!c?.name) throw new Error("GitHub did not return a machine name.");
      if (c.state !== "Available" && c.state !== "Starting") {
        setStatus("Waking up your machine (about 1 minute)…");
        const start = await gh(t, `/user/codespaces/${c.name}/start`, { method: "POST" });
        if (!start.ok) throw new Error(`Could not start the machine (${start.status}).`);
      }
      for (let i = 0; i < 120; i++) {
        const response = await gh(t, `/user/codespaces/${c.name}`);
        if (!response.ok) throw new Error(`Could not check the machine (${response.status}).`);
        const s: CS = await response.json();
        if (!s.name || !s.state) throw new Error("GitHub returned an invalid machine status.");
        setCs(s);
        if (s.state === "Available") {
          try {
            const p = await fetch(`https://${s.name}-8787.app.github.dev/info`, { headers: { Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(10000) });
            if (p.ok) {
              const info = await p.json();
              if (!info.root || !info.node) throw new Error("Runner is not ready");
              const txt = [info.node, info.py, info.rust, info.go, info.jcode ? "jcode CLI installed" : "jcode CLI unavailable", info.steel ? "Steel browser available" : "Steel browser unavailable", `Workspace: ${info.root}`].filter(Boolean).join(", ");
              setReady(true); setStatus("Linux machine connected · AI now builds full projects here"); onLinux(txt, `https://${s.name}-3000.app.github.dev`);
              toast.success("Linux machine connected"); return;
            }
            if (i > 6) setNeedAuth(true);
          } catch { if (i > 6) setNeedAuth(true); }
          setStatus("Machine is on, starting the runner…");
        } else setStatus(`Machine is ${s.state.toLowerCase()}…`);
        await new Promise((ok) => setTimeout(ok, 5000));
      }
      throw new Error("Runner did not respond. Your machine and files were preserved. Open the machine to check its startup, then retry.");
    } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); setOpen(true); }
    finally { connecting.current = false; setBusyConn(false); }
  }

  async function sync(fs = files, quiet = false) {
    try {
      const r = await fetch(`${bridge}/files`, { method: "POST", headers: auth(), body: JSON.stringify({ files: fs }) });
      if (!r.ok) throw new Error(String(r.status));
      setOut((o) => o + `\n▸ ${fs.length} files written to the machine\n`);
      if (!quiet) toast.success("Files sent to the machine");
    } catch (e) { if (!quiet) toast.error("Could not send files"); throw e; }
  }

  async function run(c = cmd, jobCommand = false) {
    if (!c.trim()) return "";
    if (working.current && !jobCommand) return "";
    let got = "";
    setRunning(true); setOut((o) => o + `\n$ ${c}\n`);
    try {
      const r = await fetch(`${bridge}/run`, { method: "POST", headers: auth(), body: JSON.stringify({ cmd: c }) });
      if (!r.ok) throw new Error(`Runner rejected command (${r.status})`);
      if (!r.body) throw new Error("Runner returned no output stream");
      const rd = r.body.getReader(); const dec = new TextDecoder();
      for (;;) { const { done, value } = await rd.read(); if (done) break; const t = dec.decode(value); got += t; setOut((o) => o + t); }
    } catch (e) { const t = `\n[error] ${e instanceof Error ? e.message : e}\n[exit 1]\n`; got += t; setOut((o) => o + t); }
    if (!jobCommand) setRunning(false); setCmd(""); return got;
  }

  async function browseUrl() {
    const url = window.prompt("Open which website in the headless browser?", "https://");
    if (!url || url === "https://") return;
    setRunning(true); setOut((o) => o + `\n🌐 browsing ${url}\n`);
    try {
      const r = await fetch(`${bridge}/browse`, { method: "POST", headers: auth(), body: JSON.stringify({ url }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      setShot(d.screenshot || "");
      setOut((o) => o + `# ${d.title}\n${String(d.markdown).slice(0, 4000)}\n`);
    } catch (e) { setOut((o) => o + `[browser error] ${e instanceof Error ? e.message : e}\n`); }
    setRunning(false);
  }

  async function stop() {
    if (!cs) return;
    try {
      const response = await gh(tok, `/user/codespaces/${cs.name}/stop`, { method: "POST" });
      if (!response.ok) throw new Error(`Could not stop machine (${response.status})`);
      setReady(false); onLinux(null); setStatus("Machine stopped · saving your free hours");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not stop machine"); }
  }

  const dot = ready ? "bg-primary shadow-[0_0_8px_var(--primary)]" : busyConn ? "bg-accent animate-pulse" : "bg-muted-foreground";

  return (
    <div className="shrink-0 border-t border-border glass">
      <Button variant="ghost" aria-label="Linux machine" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex h-9 w-full items-center gap-2 px-3 text-xs">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <Cpu className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">Linux</span>
        <span className="truncate text-muted-foreground">{busyConn && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}{status}</span>
        <span className="flex-1" />
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </Button>
      {open && (!ready ? (
        <div className="mx-auto flex max-w-xl flex-col gap-2 p-4 pt-1">
          <p className="text-xs text-muted-foreground">Paste a GitHub token once (permissions: <b>codespace</b> and <b>repo</b>, no expiration). It stays saved in this browser and connects automatically every time you open the page.</p>
          <div className="flex gap-2">
            <Input aria-label="GitHub token" type="password" placeholder="ghp_..." value={tok} onChange={(e) => setTok(e.target.value)} className="font-mono" />
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
        <div className="flex h-[38dvh] min-h-0 flex-col gap-2 p-3 pt-0">
          <div className="flex max-h-[14dvh] shrink-0 flex-wrap items-center gap-1.5 overflow-y-auto text-xs lg:max-h-none">
            <Button size="sm" variant="outline" disabled={running} onClick={() => { void sync().catch(() => {}); }}><Upload className="h-3.5 w-3.5" />Send files</Button>
            {["npm install", "npx -y serve -l 3000 .", "python3 main.py", "cargo run", "go run .", "git status"].map((q) => (
              <Button key={q} size="sm" variant="ghost" className="font-mono text-xs" disabled={running} onClick={() => run(q)}>{q}</Button>
            ))}
            <Button size="sm" variant="outline" disabled={running} onClick={browseUrl}><Globe className="h-3.5 w-3.5" />Browse web</Button>
            <span className="flex-1" />
            <Button size="sm" variant="ghost" asChild><a href={`https://${cs?.name}-7681.app.github.dev`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />jcode terminal</a></Button>
            <Button size="sm" variant="ghost" asChild><a href={`https://${cs?.name}-3000.app.github.dev`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />App :3000</a></Button>
            <Button size="sm" variant="ghost" disabled={running} onClick={stop}><Power className="h-3.5 w-3.5" />Stop</Button>
          </div>
          {shot && (
            <a href={shot} target="_blank" rel="noreferrer" className="block max-h-40 shrink-0 overflow-hidden rounded-xl border border-border">
              <img src={shot} alt="Screenshot from the headless browser" className="w-full object-cover object-top" />
            </a>
          )}
          <pre ref={outRef} className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-background/80 p-3 font-mono text-xs whitespace-pre-wrap">{out || "When the AI builds something, its files and commands run here automatically."}</pre>
          <div className="flex shrink-0 gap-2">
            <Input aria-label="Linux command" value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !running && run()} placeholder="Any Linux command, e.g. jcode --help" className="font-mono" />
            <Button aria-label="Run command" onClick={() => run()} disabled={running} className="bg-brand text-primary-foreground">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
