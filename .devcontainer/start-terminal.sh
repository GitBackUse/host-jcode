#!/usr/bin/env bash
# Starts a browser terminal on port 7681 that drops you straight into jcode.
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
pkill -f "ttyd -p 7681" 2>/dev/null || true
cd "${CODESPACE_VSCODE_FOLDER:-$PWD}"
SHELL_CMD="tmux new -A -s jcode 'command -v jcode >/dev/null && jcode; exec bash'"
nohup ttyd -p 7681 -W -t titleFixed=JCode -t fontSize=14 bash -lc "$SHELL_CMD" >/tmp/ttyd.log 2>&1 &
echo "JCode web terminal running on port 7681"
