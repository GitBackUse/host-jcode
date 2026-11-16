export type ProjectFile = { path: string; content: string };
export type AgentResult = { message: string; plan?: string[] | undefined; files: ProjectFile[]; commands: string[] };

const BROWSER_SYSTEM = `You are JCode, an elite senior full-stack engineer and product designer.
You build complete, production-quality, visually stunning web apps as plain static files: index.html, style.css, script.js (add more files only if useful).
Environment: you run in the browser studio (static files, instant preview). For npm installs, compiling Rust/Go/Python, tests, git and servers, tell the user to use the Codespace terminal (native jcode, full Linux).
Rules:
- Always return the FULL content of every file you create or change. Omit unchanged files.
- No build tools. You may use CDN scripts (e.g. Tailwind CDN, Alpine, Chart.js, Three.js) via <script src>.
- index.html must link style.css and script.js with relative paths.
- Design: modern, polished, responsive, accessible, tasteful motion. Never ship placeholders like "lorem ipsum".
- Think step by step: give a short plan (3-6 bullets) first.
Respond ONLY as JSON: {"plan": string[], "message": string, "files": [{"path": string, "content": string}], "commands": []}`;

export function linuxSystem(info: string) {
  return `You are JCode, an elite senior full-stack engineer.
ENVIRONMENT: A REAL Ubuntu Linux machine (GitHub Codespace, 2 CPUs, ~8GB RAM) is CONNECTED and ready.
Tools on it: ${info || "Node.js + npm, Python 3 + pip, Rust + cargo, Go, git, tmux, curl, apt (sudo), native jcode CLI"}.
A Steel.dev headless browser is available: the command "steel <url>" prints any web page as text plus a screenshot link (use it to read docs or check a running app).
Your files are written into the machine's "workspace" folder, then your "commands" run there in order with bash, and the output is shown to the user.
You can build ANY project in ANY language: full-stack apps (Express, FastAPI, Next/Vite), CLIs, Rust/Go/Python programs, tests, git.
Rules:
- Return FULL content of every file you create or change. Omit unchanged files.
- "commands": shell commands to install, build, test or run (e.g. "npm install", "python3 main.py", "cargo run"). Non-interactive only (use -y flags).
- Long-running servers: start them in background, e.g. "nohup npm run dev -- --host 0.0.0.0 --port 3000 > server.log 2>&1 &", and use port 3000, 5173 or 8080.
- If the project is a static website, also keep index.html at the root so the in-browser preview works.
- Give a short plan (3-6 bullets) first.
Respond ONLY as JSON: {"plan": string[], "message": string, "files": [{"path": string, "content": string}], "commands": string[]}`;
}

export async function runAgent(opts: {
  apiKey: string; model: string; prompt: string; files: ProjectFile[];
  history: { role: "user" | "model"; text: string }[];
  linux?: string | null | undefined;
}): Promise<AgentResult> {
  const context = opts.files.length
    ? `Current project files:\n${opts.files.map((f) => `--- ${f.path}\n${f.content}`).join("\n\n")}\n\n`
    : "The project is empty.\n\n";
  const contents = [
    ...opts.history.slice(-8).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: `${context}Request: ${opts.prompt}` }] },
  ];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.linux != null ? linuxSystem(opts.linux) : BROWSER_SYSTEM }] },
        contents,
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  try {
    const parsed = JSON.parse(text.replace(/^```json\s*|```$/g, ""));
    return { message: parsed.message ?? "Done.", plan: parsed.plan, files: Array.isArray(parsed.files) ? parsed.files : [], commands: Array.isArray(parsed.commands) ? parsed.commands.filter((c: unknown) => typeof c === "string") : [] };
  } catch {
    return { message: text || "No response.", files: [], commands: [] };
  }
}

export function buildPreview(files: ProjectFile[]): string {
  const get = (p: string) => files.find((f) => f.path === p)?.content;
  let html = get("index.html") ?? "<!doctype html><html><body style='font-family:sans-serif;display:grid;place-items:center;height:100vh;color:#888'>Nothing to preview yet</body></html>";
  html = html.replace(/<link[^>]+href=["']\.?\/?([^"']+\.css)["'][^>]*>/g, (m, p) => {
    const c = get(p); return c != null ? `<style>${c}</style>` : m;
  });
  html = html.replace(/<script([^>]*)src=["']\.?\/?([^"':]+\.js)["']([^>]*)><\/script>/g, (m, a, p, b) => {
    const c = get(p); return c != null ? `<script${a}${b}>${c.replace(/<\/script>/g, "<\\/script>")}</script>` : m;
  });
  return html;
}
