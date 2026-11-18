#!/usr/bin/env bash
# What the review of a declaration reads (job summary of a pull request): the version and
# commit against main's, the permissions of the risk catalog, the files of the archive with
# their size.
#
#   scripts/report.sh <id> <work dir> <base sha>
set -euo pipefail
id="$1"; work="$2"; base="$3"
dir="$work/out/$id"
echo
echo "### \`$id\`"
before="$(git show "$base:catalog/$id.yaml" 2>/dev/null || true)"
if [ -z "$before" ]; then echo "New in the catalog."; else
  echo "Before:"; echo '```yaml'; echo "$before"; echo '```'
fi
echo "Now:"; echo '```yaml'; cat "catalog/$id.yaml"; echo '```'
echo "Permissions (risk-catalog.yaml):"
echo '```'
grep -E '^\s*- id: ' "$dir/risk-catalog.yaml" | sed -E 's/^\s*- id: //'
echo '```'
echo "Files of the archive:"
echo '```'
(cd "$dir" && find . -type f -printf '%s\t%p\n' | sort -k2)
echo '```'
echo "Review the classifier and the execution code of the declared commit; a write classified as a read is a refusal."
