#!/usr/bin/env bash
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
echo "=== Host JCode ready ==="
if [ -n "$GEMINI_API_KEY" ]; then echo "Gemini key detected (Codespaces secret)."; else echo "No GEMINI_API_KEY secret yet — run: jcode login --provider gemini"; fi
echo "Start jcode by typing: jcode"
