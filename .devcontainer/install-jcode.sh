#!/usr/bin/env bash
set -e
echo "Installing jcode (official installer)..."
curl -fsSL https://jcode.sh/install | bash
grep -q '.local/bin' ~/.bashrc || echo 'export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
command -v jcode && jcode --version || echo "jcode installed; open a new terminal if not found."
