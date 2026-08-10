#!/usr/bin/env bash
# Round-trip tests for site/index.html.
#
# Two properties have to hold, and neither is obvious from reading the code:
#
#   1. NO-OP IS LOSSLESS. Import the file into itself; the result must be byte
#      identical. If a round trip that changes nothing still moves bytes, a
#      real round trip cannot be trusted either.
#   2. A PARTIAL RETURN IS SAFE. Design returned one page out of three the
#      first time. Feed back a restyled single view and the other twelve must
#      survive untouched, not be dropped.
set -euo pipefail
cd "$(dirname "$0")/../.."

BEFORE=$(mktemp); trap 'rm -f "$BEFORE" /tmp/design-return.html' EXIT
cp site/index.html "$BEFORE"

echo "== 1. no-op round trip =="
cp site/index.html /tmp/selfcopy.html
python3 scripts/design/import_from_design.py /tmp/selfcopy.html >/dev/null
rm -f /tmp/selfcopy.html design/incoming/selfcopy.html
cmp -s "$BEFORE" site/index.html && echo "PASS  identical" || { echo "FAIL  bytes moved"; exit 1; }

echo "== 2. partial return, 1 view of 13 =="
python3 scripts/design/simulate_design_return.py >/dev/null
python3 scripts/design/import_from_design.py /tmp/design-return.html >/dev/null
rm -f design/incoming/design-return.html
python3 - "$BEFORE" <<'PY'
import sys, re
sys.path.insert(0, 'scripts/design')
from import_from_design import split_views
before = split_views(open(sys.argv[1]).read())
after = split_views(open('site/index.html').read())
changed = [v for v in before if before[v] != after.get(v)]
ok = changed == ['/'] and '#3fb6c8' in after['/'] and '#c9a227' in after['/archive']
print(f"{'PASS' if ok else 'FAIL'}  {len(changed)} view changed, {len(before)-len(changed)} kept")
sys.exit(0 if ok else 1)
PY

cp "$BEFORE" site/index.html
echo "restored"
