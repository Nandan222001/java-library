#!/bin/bash
set -euo pipefail

# Only needed for Claude Code on the web — locally, developers run
# `npm install` themselves per README.md.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Two independent npm projects, no workspaces — each needs its own install.
cd "$CLAUDE_PROJECT_DIR/web"
npm install

cd "$CLAUDE_PROJECT_DIR/server"
npm install
