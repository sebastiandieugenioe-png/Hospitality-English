#!/bin/bash
# Runs backend suite against local backend file-by-file, throttled to avoid ephemeral port exhaustion
# (preview container has only 1024 local ports) and Cloudflare 429s on the public URL.
cd /app/backend
export REACT_APP_BACKEND_URL=http://localhost:8001
mkdir -p /tmp/pyrun && rm -f /tmp/pyrun/*.xml
for f in tests/test_*.py; do
  while [ "$(ss -tan | grep -c TIME-WAIT)" -gt 250 ]; do sleep 3; done
  n=$(basename "$f" .py)
  python -m pytest "$f" -q -n 0 --tb=short -p no:cacheprovider --junitxml=/tmp/pyrun/$n.xml > /tmp/pyrun/$n.log 2>&1
  echo "$n: $(tail -1 /tmp/pyrun/$n.log)"
done
echo DONE
