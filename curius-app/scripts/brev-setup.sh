#!/bin/bash
# Brev.dev GPU Instance Setup for Curius Tagging
# Run this after SSH'ing into your Brev instance

set -e

echo "=============================================="
echo "   CURIUS BREV GPU SETUP"
echo "=============================================="

# Install Node.js
echo ""
echo "[1/6] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chromium for Puppeteer
echo ""
echo "[2/6] Installing Chromium dependencies..."
sudo apt-get install -y \
  chromium-browser \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libasound2

# Install Ollama
echo ""
echo "[3/6] Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama in background
echo ""
echo "[4/6] Starting Ollama..."
nohup ollama serve > /tmp/ollama.log 2>&1 &
sleep 5

# Pull the model
echo ""
echo "[5/6] Pulling LLM model..."
echo ""
echo "GPU VRAM Guide:"
echo "  2x A100-80GB  -> deepseek-v2.5 or qwen2.5:72b"
echo "  1x A100-80GB  -> qwen2.5:72b or mixtral:8x22b"
echo "  1x L40S-48GB  -> qwen2.5:32b or llama3.1:70b"
echo "  1x A10G-24GB  -> qwen2.5:14b or llama3.1:8b"
echo ""

MODEL=${OLLAMA_MODEL:-"qwen2.5:72b"}
echo "Pulling $MODEL (this may take a while)..."
ollama pull $MODEL

# Setup repo
echo ""
echo "[6/6] Setting up Curius..."
if [ ! -d "curius-app" ]; then
  echo "Clone your repo here or copy files"
fi

cd curius-app 2>/dev/null || cd .

npm install

# Create/update env
cat > .env.local << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://dhqiswshazmzkkpcnrza.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocWlzd3NoYXptemtrcGNucnphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Nzc0MjcsImV4cCI6MjA3NjQ1MzQyN30.Egd7GGaaH9m7KkwkKxOkP_Qw3FHs5SVFzXF0mmo-1FY

# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:72b

# Performance
CONCURRENCY=5
FETCH_TIMEOUT=8000
PUPPETEER_CONCURRENCY=2
PAGE_TIMEOUT=15000
EOF

echo ""
echo "=============================================="
echo "   SETUP COMPLETE"
echo "=============================================="
echo ""
echo "Run tagging:"
echo "  npm run tag           # Two-pass (fetch + puppeteer)"
echo "  npm run tag:pass1     # Pass 1 only (simple fetch)"
echo "  npm run tag:pass2     # Pass 2 only (puppeteer)"
echo "  npm run tag:status    # Check progress"
echo ""
echo "Background run with logging:"
echo "  nohup npm run tag > tagging.log 2>&1 &"
echo "  tail -f tagging.log"
echo ""
echo "Monitor Ollama:"
echo "  tail -f /tmp/ollama.log"
echo ""
