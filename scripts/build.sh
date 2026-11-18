#!/usr/bin/env bash
# Builds one declared plugin from its declared commit, with the catalog's toolchain:
#
#   scripts/build.sh <id> <work dir>
#
# writes <work dir>/out/<id>/ (the archive's folder, unsigned) and prints its manifest. The
# plugin's own repository provides its sources and dependencies; the toolchain (the gateway
# commit of toolchain.json) provides vaubaan-plugin. Nothing here holds a secret: the pull
# request workflow runs it as it is, the release workflow signs what it built afterwards.
set -euo pipefail

id="$1"
work="$2"
here="$(cd "$(dirname "$0")/.." && pwd)"
decl="$(node "$here/scripts/declarations.mjs" json "$id")"
field() { node -e "process.stdout.write(String(JSON.parse(process.argv[1])[process.argv[2]]))" "$decl" "$1"; }
repo="$(field repo)"
commit="$(field commit)"
path="$(field path)"
version="$(field version)"
tool_repo="$(node -e "process.stdout.write(require('$here/toolchain.json').repo)")"
tool_commit="$(node -e "process.stdout.write(require('$here/toolchain.json').commit)")"

fetch() { # <repo> <commit> <dir>
  if [ -d "$3/.git" ]; then return; fi
  git init -q "$3"
  git -C "$3" fetch -q --depth 1 "$1" "$2"
  git -C "$3" checkout -q FETCH_HEAD
  if [ "$(git -C "$3" rev-parse HEAD)" != "$2" ]; then
    echo "$1 at $2: the fetched commit is not the declared one" >&2
    exit 1
  fi
}

mkdir -p "$work/out"
fetch "$tool_repo" "$tool_commit" "$work/toolchain"
if [ ! -d "$work/toolchain/node_modules" ]; then (cd "$work/toolchain" && npm ci --ignore-scripts --no-audit --no-fund); fi

src="$work/src-$id"
if [ "$repo" = "$tool_repo" ] && [ "$commit" = "$tool_commit" ]; then
  src="$work/toolchain"
else
  fetch "$repo" "$commit" "$src"
  # The plugin's dependencies, its own SDK copy among them; no install script runs.
  (cd "$src" && npm ci --ignore-scripts --no-audit --no-fund)
fi

node "$work/toolchain/packages/plugin-cli/src/cli.ts" build "$src/$path" --out "$work/out/$id"

manifest="$work/out/$id/vaubaan-manifest.json"
node -e "
  const m = require(process.argv[1]);
  if (m.id !== process.argv[2] || m.version !== process.argv[3]) {
    console.error('the archive is ' + m.id + ' ' + m.version + ', the declaration ' + process.argv[2] + ' ' + process.argv[3]);
    process.exit(1);
  }
" "$manifest" "$id" "$version"
cat "$manifest"
