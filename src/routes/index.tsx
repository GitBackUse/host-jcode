import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, Send, KeyRound, Code2, Eye, Monitor, Smartphone, Tablet, Download, Github,
  Terminal, FileCode2, Plus, Trash2, Loader2, RotateCcw, Zap, Brain, Layers, Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { buildPreview, runAgent, type ProjectFile } from "@/lib/gemini";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JCode Studio — AI app builder with your Gemini key" },
      { name: "description", content: "Describe an app and JCode writes, previews and ships it. Free, in your browser, powered by your own Gemini key." },
      { property: "og:title", content: "JCode Studio — AI app builder" },
      { property: "og:description", content: "Describe an app, get working code with live preview. Bring your own Gemini key." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

type Msg = { role: "user" | "model"; text: string; plan?: string[] | undefined; changed?: string[] | undefined };
const MODELS: string[] = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];
const IDEAS = ["A crypto portfolio dashboard with live charts", "A Pomodoro timer with ambient sounds", "A 3D product landing page for wireless earbuds", "A kanban board with drag and drop"];
const LS = { key: "jcode.gemini", model: "jcode.model", files: "jcode.files", msgs: "jcode.msgs" };

function Studio() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<string>("gemini-2.5-flash");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [active, setActive] = useState("index.html");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem(LS.key) ?? "");
    setModel(localStorage.getItem(LS.model) ?? "gemini-2.5-flash");
    try { setFiles(JSON.parse(localStorage.getItem(LS.files) ?? "[]")); setMsgs(JSON.parse(localStorage.getItem(LS.msgs) ?? "[]")); } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) { localStorage.setItem(LS.files, JSON.stringify(files)); localStorage.setItem(LS.msgs, JSON.stringify(msgs)); } }, [files, msgs, loaded]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const preview = useMemo(() => buildPreview(files), [files]);
  const current = files.find((f) => f.path === active);
  const started = msgs.length > 0 || files.length > 0;

  async function send(text = prompt) {
    const p = text.trim();
    if (!p || busy) return;
    if (!apiKey) { setKeyOpen(true); toast("Add your Gemini key to start building"); return; }
    setPrompt(""); setBusy(true);
    const history = msgs.map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: p }]);
    try {
      const r = await runAgent({ apiKey, model, prompt: p, files, history });
      setFiles((prev) => {
        const map = new Map(prev.map((f) => [f.path, f]));
        r.files.forEach((f) => map.set(f.path, f));
        return [...map.values()];
      });
      if (r.files[0] && !files.length) setActive("index.html");
      setMsgs((m) => [...m, { role: "model", text: r.message, plan: r.plan, changed: r.files.map((f) => f.path) }]);
      setTab("preview");
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      setMsgs((m) => [...m, { role: "model", text: `⚠ ${err}` }]);
      toast.error("Generation failed");
    } finally { setBusy(false); }
  }

  function saveKey() {
    localStorage.setItem(LS.key, keyDraft.trim()); setApiKey(keyDraft.trim());
    localStorage.setItem(LS.model, model); setKeyOpen(false); toast.success("Gemini key saved in this browser");
  }
  function download() {
    const blob = new Blob([preview], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "jcode-app.html"; a.click();
  }
  function reset() { if (confirm("Start a new project?")) { setFiles([]); setMsgs([]); } }
  function updateFile(content: string) { setFiles((fs) => fs.map((f) => (f.path === active ? { ...f, content } : f))); }
  function addFile() { const n = prompt_("File name (e.g. about.html)"); if (n && !files.some((f) => f.path === n)) { setFiles((f) => [...f, { path: n, content: "" }]); setActive(n); setTab("code"); } }
  function delFile(p: string) { setFiles((f) => f.filter((x) => x.path !== p)); }

  const keyDialog = (
    <Dialog open={keyOpen} onOpenChange={(o) => { setKeyOpen(o); if (o) setKeyDraft(apiKey); }}>
      <DialogContent className="glass">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Your Gemini key</DialogTitle>
          <DialogDescription>Stored only in this browser and sent straight to Google. Get one free at Google AI Studio.</DialogDescription>
        </DialogHeader>
        <Input type="password" placeholder="AIza..." value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} className="font-mono" />
        <div className="flex flex-wrap gap-2">
          {MODELS.map((m) => (
            <button key={m} onClick={() => setModel(m)} className={`rounded-full border px-3 py-1 font-mono text-xs transition ${model === m ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{m}</button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-4 hover:underline">Get a free key →</a>
          <Button onClick={saveKey} disabled={!keyDraft.trim()} className="bg-brand text-primary-foreground">Save key</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const header = (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 glass">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand"><Code2 className="h-4 w-4 text-primary-foreground" /></div>
        <span className="font-semibold tracking-tight">JCode<span className="text-brand"> Studio</span></span>
      </div>
      <div className="flex items-center gap-1.5">
        {started && <Button size="sm" variant="ghost" onClick={reset} title="New project"><RotateCcw className="h-4 w-4" /></Button>}
        <Button size="sm" variant="ghost" asChild title="Open real jcode in a Codespace">
          <a href="https://codespaces.new/GitBackUse/host-jcode?quickstart=1" target="_blank" rel="noreferrer"><Terminal className="h-4 w-4" /><span className="hidden sm:inline">jcode CLI</span></a>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setKeyOpen(true)} className="gap-1.5">
          <span className={`h-2 w-2 rounded-full ${apiKey ? "bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-destructive"}`} />
          <span className="hidden sm:inline">{apiKey ? model : "Add Gemini key"}</span><KeyRound className="h-4 w-4 sm:hidden" />
        </Button>
      </div>
    </header>
  );

  if (!started) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden aurora">
        <div className="pointer-events-none absolute inset-0 grid-fade" />
        {header}
        <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground glass">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Free forever · your key · your code
          </div>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Describe it.<br /><span className="text-brand">JCode builds it.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">An AI engineer that plans, writes and previews full apps in seconds — then keeps refining them with you.</p>
          <div className="mt-9 w-full rounded-2xl p-[1px] bg-brand shadow-[0_20px_80px_-20px_var(--glow-b)]">
            <div className="rounded-2xl bg-background/95 p-3">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={3} placeholder="Build me a sleek habit tracker with streaks and dark mode…" className="w-full resize-none bg-transparent p-2 text-base outline-none placeholder:text-muted-foreground" />
              <div className="flex items-center justify-between">
                <span className="pl-2 font-mono text-xs text-muted-foreground">{model}</span>
                <Button onClick={() => send()} disabled={!prompt.trim()} className="gap-2 bg-brand text-primary-foreground"><Zap className="h-4 w-4" />Build</Button>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {IDEAS.map((i) => (
              <button key={i} onClick={() => send(i)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground glass">{i}</button>
            ))}
          </div>
          <div className="mt-16 grid w-full gap-3 sm:grid-cols-3">
            {[{ i: Brain, t: "Plans first", d: "Thinks through the design before writing code." }, { i: Layers, t: "Multi-file", d: "Real HTML, CSS and JS you can edit by hand." }, { i: Rocket, t: "Ship anywhere", d: "Download one file or run full jcode in a Codespace." }].map(({ i: I, t, d }, n) => (
              <div key={t} className="rounded-xl p-4 text-left glass animate-floaty" style={{ animationDelay: `${n * 0.8}s` }}>
                <I className="mb-2 h-5 w-5 text-primary" /><div className="font-medium">{t}</div><div className="text-sm text-muted-foreground">{d}</div>
              </div>
            ))}
          </div>
        </main>
        {keyDialog}
      </div>
    );
  }

  const width = device === "desktop" ? "100%" : device === "tablet" ? "768px" : "390px";

  return (
    <div className="flex h-screen flex-col aurora">
      {header}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Chat */}
        <aside className="flex max-h-[45vh] min-h-0 flex-col border-b border-border lg:max-h-none lg:w-[380px] lg:border-b-0 lg:border-r">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-8 rounded-2xl rounded-tr-sm bg-secondary px-4 py-2.5 text-sm" : "text-sm"}>
                {m.role === "model" && <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5" />JCode</div>}
                {m.plan && m.plan.length > 0 && (
                  <ul className="mb-2 space-y-1 rounded-lg p-3 glass">
                    {m.plan.map((s, j) => <li key={j} className="flex gap-2 text-xs text-muted-foreground"><span className="text-primary">✓</span>{s}</li>)}
                  </ul>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                {m.changed && m.changed.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">{m.changed.map((c) => <button key={c} onClick={() => { setActive(c); setTab("code"); }} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-primary">{c}</button>)}</div>
                )}
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />Planning and writing code…</div>}
            <div ref={chatEnd} />
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2 rounded-xl border border-border p-2 glass focus-within:border-primary">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={2} placeholder="Ask for a change…" className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              <Button size="icon" onClick={() => send()} disabled={busy || !prompt.trim()} className="bg-brand text-primary-foreground"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </aside>

        {/* Workspace */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
            <div className="flex rounded-lg border border-border p-0.5">
              {(["preview", "code"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs capitalize transition ${tab === t ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
                  {t === "preview" ? <Eye className="h-3.5 w-3.5" /> : <FileCode2 className="h-3.5 w-3.5" />}{t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {tab === "preview" && ([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, I]) => (
                <Button key={d} size="icon" variant="ghost" className={`h-8 w-8 ${device === d ? "text-primary" : ""}`} onClick={() => setDevice(d)}><I className="h-4 w-4" /></Button>
              ))}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={download} title="Download app"><Download className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" asChild title="Repository"><a href="https://github.com/GitBackUse/host-jcode" target="_blank" rel="noreferrer"><Github className="h-4 w-4" /></a></Button>
            </div>
          </div>

          {tab === "preview" ? (
            <div className="flex min-h-[50vh] flex-1 justify-center overflow-auto p-3">
              <iframe title="Preview" srcDoc={preview} sandbox="allow-scripts allow-forms allow-modals allow-popups"
                style={{ width }} className="h-full rounded-xl border border-border bg-background shadow-[0_30px_80px_-30px_var(--glow-c)] transition-all" />
            </div>
          ) : (
            <div className="flex min-h-[50vh] flex-1">
              <div className="w-40 shrink-0 overflow-y-auto border-r border-border p-2 sm:w-48">
                <div className="mb-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-widest text-muted-foreground">Files<button onClick={addFile}><Plus className="h-3.5 w-3.5 hover:text-primary" /></button></div>
                {files.map((f) => (
                  <div key={f.path} className={`group flex items-center justify-between rounded-md px-2 py-1.5 font-mono text-xs ${active === f.path ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                    <button className="truncate text-left" onClick={() => setActive(f.path)}>{f.path}</button>
                    <button onClick={() => delFile(f.path)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
              {current ? <CodeEditor value={current.content} onChange={updateFile} /> : <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Pick a file</div>}
            </div>
          )}
        </section>
      </div>
      {keyDialog}
    </div>
  );
}

function prompt_(q: string) { return typeof window !== "undefined" ? window.prompt(q)?.trim() : undefined; }

function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const lines = value.split("\n").length;
  const gutter = useRef<HTMLDivElement>(null);
  return (
    <div className="flex min-w-0 flex-1 overflow-hidden bg-background/60 font-mono text-[13px] leading-6">
      <div ref={gutter} className="select-none overflow-hidden px-3 py-3 text-right text-muted-foreground/50">
        {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea value={value} spellCheck={false} onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }}
        onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); const t = e.currentTarget; const s = t.selectionStart; onChange(value.slice(0, s) + "  " + value.slice(t.selectionEnd)); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; }); } }}
        className="flex-1 resize-none whitespace-pre bg-transparent py-3 pr-4 text-foreground outline-none" />
    </div>
  );
}
