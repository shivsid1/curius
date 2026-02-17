# Curius Tagger - Brev GPU Instructions

## Quick Start (5 minutes)

### 1. Create Brev Instance
- Go to [brev.dev](https://brev.dev)
- Create new instance: **L40S** (48GB VRAM) - ~$1.20/hr
- Or use **A10G** (24GB) with `qwen2.5:14b` instead - ~$0.75/hr

### 2. SSH into Instance
```bash
brev shell <instance-name>
# or use the SSH command from Brev dashboard
```

### 3. Run Setup Script
```bash
# Copy and paste this entire block:
curl -O https://raw.githubusercontent.com/YOUR_REPO/scripts/brev-full-setup.sh
bash brev-full-setup.sh
```

Or manually:
```bash
# Install dependencies
sudo apt-get update && sudo apt-get install -y nodejs npm curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
nohup ollama serve > /tmp/ollama.log 2>&1 &
sleep 5

# Pull model (takes 10-15 min)
ollama pull qwen2.5:32b

# Setup project
mkdir -p ~/curius && cd ~/curius
npm init -y
npm install @supabase/supabase-js dotenv
```

### 4. Copy Files
Copy these from your local machine:
- `tag-all.js`
- `.env` (with your keys)

```bash
# From your LOCAL terminal:
scp scripts/tag-all.js brev-instance:~/curius/
scp .env.local brev-instance:~/curius/.env
```

### 5. Run Tagger
```bash
cd ~/curius

# Check status first
node tag-all.js --status

# Run in background (keeps running after you disconnect)
nohup node tag-all.js > tagger.log 2>&1 &

# Watch progress
tail -f tagger.log
```

### 6. Disconnect & Relax
```bash
# Press Ctrl+A, then D to detach from screen (or just close terminal)
# The tagger keeps running on Brev
```

---

## Monitoring

### Check Progress
```bash
# From Brev:
node tag-all.js --status

# Or watch the log:
tail -f ~/curius/tagger.log
```

### GPU Usage
```bash
watch -n 1 nvidia-smi
```

### Ollama Logs
```bash
tail -f /tmp/ollama.log
```

---

## Costs

| GPU | Model | Speed | Cost for 155K |
|-----|-------|-------|---------------|
| L40S | qwen2.5:32b | ~1s/item | ~$40-50 |
| A10G | qwen2.5:14b | ~0.5s/item | ~$20-30 |

---

## Troubleshooting

### Ollama not responding
```bash
pkill ollama
nohup ollama serve > /tmp/ollama.log 2>&1 &
sleep 5
ollama list
```

### Out of GPU memory
Use smaller model:
```bash
export OLLAMA_MODEL=qwen2.5:14b
node tag-all.js
```

### Rate limited by Firecrawl
Increase delay in .env:
```
FIRECRAWL_DELAY_MS=500
```

### Resume after crash
Just run again - progress is saved in Supabase:
```bash
node tag-all.js
```
