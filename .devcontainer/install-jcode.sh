#!/usr/bin/env bash
set -e
echo "Installing jcode (official installer)..."
curl -fsSL https://jcode.sh/install | bash
grep -q '.local/bin' ~/.bashrc || echo 'export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
echo "Installing ttyd (web terminal)..."
mkdir -p "$HOME/.local/bin"
ARCH=$(uname -m); [ "$ARCH" = "aarch64" ] && T=aarch64 || T=x86_64
curl -fsSL -o "$HOME/.local/bin/ttyd" "https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.$T"
chmod +x "$HOME/.local/bin/ttyd"
sudo apt-get update -y && sudo apt-get install -y tmux >/dev/null || true
command -v jcode && jcode --version || echo "jcode installed; open a new terminal if not found."
