#!/bin/bash
# =============================================================================
# BREV GPU FULL SETUP - Curius Bookmark Tagger
# =============================================================================
# Run this after SSH'ing into your Brev L40S instance
# Usage: bash brev-full-setup.sh
# =============================================================================

set -e

echo "=============================================="
echo "   CURIUS BREV TAGGER SETUP"
echo "=============================================="
echo ""

# -----------------------------------------------------------------------------
# 1. System dependencies
# -----------------------------------------------------------------------------
echo "[1/5] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq nodejs npm git curl

# Upgrade to Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# -----------------------------------------------------------------------------
# 2. Install Ollama
# -----------------------------------------------------------------------------
echo ""
echo "[2/5] Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama in background
echo "Starting Ollama server..."
nohup ollama serve > /tmp/ollama.log 2>&1 &
sleep 5

# Verify Ollama is running
if curl -s http://localhost:11434/api/tags > /dev/null; then
  echo "Ollama is running"
else
  echo "ERROR: Ollama failed to start. Check /tmp/ollama.log"
  exit 1
fi

# -----------------------------------------------------------------------------
# 3. Pull the model
# -----------------------------------------------------------------------------
echo ""
echo "[3/5] Pulling LLM model (this takes 10-15 min)..."
echo ""
echo "GPU detected:"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null || echo "No NVIDIA GPU found"
echo ""

# Use qwen2.5:32b for L40S (48GB), or qwen2.5:14b for A10G (24GB)
MODEL="${OLLAMA_MODEL:-qwen2.5:32b}"
echo "Pulling $MODEL..."
ollama pull $MODEL

echo "Model ready. Testing..."
echo '{"model":"'$MODEL'","prompt":"Say OK","stream":false}' | \
  curl -s -X POST http://localhost:11434/api/generate -d @- | head -c 200
echo ""

# -----------------------------------------------------------------------------
# 4. Setup project
# -----------------------------------------------------------------------------
echo ""
echo "[4/5] Setting up Curius tagger..."

mkdir -p ~/curius
cd ~/curius

# Create package.json
cat > package.json << 'PACKAGE_EOF'
{
  "name": "curius-brev-tagger",
  "version": "1.0.0",
  "type": "commonjs",
  "dependencies": {
    "@supabase/supabase-js": "^2.75.1",
    "dotenv": "^16.4.5"
  }
}
PACKAGE_EOF

npm install

# -----------------------------------------------------------------------------
# 5. Create .env file
# -----------------------------------------------------------------------------
echo ""
echo "[5/5] Creating environment file..."

cat > .env << 'ENV_EOF'
# Supabase
SUPABASE_URL=https://dhqiswshazmzkkpcnrza.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocWlzd3NoYXptemtrcGNucnphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Nzc0MjcsImV4cCI6MjA3NjQ1MzQyN30.Egd7GGaaH9m7KkwkKxOkP_Qw3FHs5SVFzXF0mmo-1FY

# Firecrawl
FIRECRAWL_KEY=fc-acd9177bb2144f0dacbcbe067bb33efd

# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:32b

# Performance tuning
CONCURRENCY=8
FIRECRAWL_DELAY_MS=200
ENV_EOF

echo ""
echo "=============================================="
echo "   SETUP COMPLETE"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Copy tag-all.js to ~/curius/"
echo "  2. Run: cd ~/curius && node tag-all.js"
echo ""
echo "For background execution:"
echo "  nohup node tag-all.js > tagger.log 2>&1 &"
echo "  tail -f tagger.log"
echo ""
echo "Monitor GPU:"
echo "  watch -n 1 nvidia-smi"
echo ""
