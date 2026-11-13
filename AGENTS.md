<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Environment for JCode (AI agent read this)
- You run as native jcode inside a GitHub Codespace: real Ubuntu Linux, 2 CPU cores, ~8GB RAM, ~32GB disk.
- Installed: Node.js + npm, Python 3 + pip, Rust + cargo, Go, git, tmux, curl, apt (sudo works).
- You can: install packages, compile and run code, run tests, start dev servers, use git (commit, branch, push to this repo).
- Dev servers on ports 5173, 3000, 8080 are forwarded and previewable from the portal.
- The repo is the permanent storage; anything not committed and pushed can be lost when the Codespace is deleted.
- GitHub Pages hosts the portal (portal/); GitHub Actions deploys it on push to main.
- The Codespace auto-stops when idle; free tier is limited hours per month, so keep work efficient.
- AI key comes from the GEMINI_API_KEY Codespaces secret; never write keys into files.
