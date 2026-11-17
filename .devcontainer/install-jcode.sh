#!/usr/bin/env bash
set -e
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
if ! command -v jcode >/dev/null; then
  echo "Installing jcode (official installer)..."
  curl -fsSL https://jcode.sh/install | bash
fi
grep -q '.local/bin' ~/.bashrc || echo 'export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
echo "Installing ttyd (web terminal)..."
mkdir -p "$HOME/.local/bin"
ARCH=$(uname -m); [ "$ARCH" = "aarch64" ] && T=aarch64 || T=x86_64
if [ ! -x "$HOME/.local/bin/ttyd" ]; then
  curl -fsSL -o "$HOME/.local/bin/ttyd" "https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.$T"
fi
chmod +x "$HOME/.local/bin/ttyd"
sudo apt-get update -y && sudo apt-get install -y tmux >/dev/null || true
command -v jcode && jcode --version || echo "jcode installed; open a new terminal if not found."
