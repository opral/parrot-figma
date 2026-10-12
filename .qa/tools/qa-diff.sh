#!/bin/sh
# Show what QA changed since refs/qa/baseline (includes untracked files). Usage: .qa/tools/qa-diff.sh [--stat] [paths...]
cd "$(dirname "$0")/../.." || exit 1
IDX=$(mktemp); export GIT_INDEX_FILE=$IDX
git read-tree refs/qa/baseline && git add -A -- src README.md manifest.json package.json vite.config.ts vite.config.plugin.ts
git diff --cached refs/qa/baseline "$@"
rm -f "$IDX"
