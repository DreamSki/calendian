#!/bin/bash
# Build main.js from main-head.js and src/ modules
# REQ-ARCH-001: cat-based concatenation — zero external tools
# Inserts src/*.js prototype methods at the INSERT_SRC_MODULES sentinel in main-head.js
set -e

cd "$(dirname "$0")"

SENTINEL='// ===< INSERT_SRC_MODULES >==='
SENTINEL_LINE=$(grep -n "$SENTINEL" main-head.js | cut -d: -f1)

if [ -z "$SENTINEL_LINE" ]; then
  echo "ERROR: Sentinel '$SENTINEL' not found in main-head.js"
  exit 1
fi

# Part 1: before sentinel
head -n $((SENTINEL_LINE - 1)) main-head.js > main.js
# Part 2: src/ modules (prototype methods)
cat src/reminders/temporal.js src/macos/helper-executor.js src/cache/schedule-cache.js src/macos/writer.js src/macos/notifications.js src/notes/frontmatter.js src/notes/note-link-resolver.js src/notes/templates.js src/notes/tasks-integration.js src/notes/codeblock.js >> main.js
# Part 3: after sentinel (skip sentinel line itself)
tail -n +$((SENTINEL_LINE + 1)) main-head.js >> main.js

echo "main.js built ($(wc -l < main.js) lines)"
