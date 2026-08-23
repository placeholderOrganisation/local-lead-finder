#!/usr/bin/env bash
# Wrapper the scheduler (cron / launchd) invokes to run ONE worker tick.
#
# Why a wrapper? cron and launchd run with a bare environment and an empty PATH,
# so `node` often isn't found and the cwd is "/". This resolves the repo dir,
# puts node on PATH (covers Homebrew + nvm), and runs the one-shot worker. The
# worker loads .env itself (src/env.js reads <repo>/.env), so your secrets never
# have to live in the crontab.
set -euo pipefail

# Absolute path to the repo (the parent of this script's directory).
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Schedulers start with a minimal PATH — add the usual node locations.
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
# If you use nvm, make its default node available too.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi

echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] worker tick — $PROJECT_DIR"
exec node src/worker.js
