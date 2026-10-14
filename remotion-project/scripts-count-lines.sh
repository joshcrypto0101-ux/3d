#!/bin/sh
# Writes the project's own line count into src/code-lines.json (shown on the end card).
cd "$(dirname "$0")"
n=$(cat src/*.ts src/*.tsx src/*/*.ts src/*/*.tsx src/*/*/*.ts src/*/*/*.tsx data/*.json 2>/dev/null | wc -l | tr -d ' ')
printf '{"lines": "%s"}\n' "$(printf '%s' "$n" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')" > src/code-lines.json
cat src/code-lines.json
