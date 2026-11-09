#!/usr/bin/env bash
# Apply safety fixes to STOPPED Genesis on pve. No start or VM reboot.
set -Eeuo pipefail
umask 077
KEY=/root/.ssh/genesis_ed25519
BACKUP=/root/genesis-experiments/experiment-004-oom-safety-backup
STAGE=/root/genesis-safety-stage
BASE=https://raw.githubusercontent.com/mtrccl/the-living-lab/main
guest(){ ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=8 genesis@10.220.0.2 "$@"; }
fail(){ echo "ERROR: $*" >&2; exit 1; }
[[ "$(id -u)" == 0 && -s "$KEY" ]] || fail "Run as root on pve with Genesis SSH key"
[[ "$(cat /var/lib/genesis-reports/active-experiment.txt)" == 004 ]] || fail "Unexpected experiment"
[[ ! -e "$BACKUP" ]] || fail "Backup already exists: do not rerun"
! systemctl is-active --quiet genesis-sample.timer || fail "Sampler must be stopped"
guest 'test "$(hostname)" = genesis && ! systemctl is-active --quiet genesis && ! systemctl is-enabled --quiet genesis' || fail "Guest Genesis must be stopped and disabled"
guest 'sudo test -s /var/lib/genesis/experiment-004/world.json' || fail "Post-OOM checkpoint missing"
mkdir -m 700 "$BACKUP"
guest 'sudo cat /var/lib/genesis/experiment-004/world.json' > "$BACKUP/world-post-oom.json"
GUEST_HASH=$(guest 'sudo sha256sum /var/lib/genesis/experiment-004/world.json' | awk '{print $1}')
[[ "$GUEST_HASH" == "$(sha256sum "$BACKUP/world-post-oom.json" | awk '{print $1}')" ]] || fail "Checkpoint copy mismatch"
guest 'sudo tar -C /opt/genesis/runner -czf - runner.mjs behavior.mjs engine.mjs persistence.mjs world-engine.mjs' > "$BACKUP/old-runner.tar.gz"
tar -tzf "$BACKUP/old-runner.tar.gz" >/dev/null
python3 - /var/lib/genesis-reports/history.sqlite3 "$BACKUP/history-004.sqlite3" <<'PY'
import sqlite3,sys
with sqlite3.connect(sys.argv[1]) as src,sqlite3.connect(sys.argv[2]) as dest:
    src.backup(dest)
with sqlite3.connect(sys.argv[2]) as db:
    assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    print('Saved observations:',db.execute('SELECT COUNT(*) FROM observations').fetchone()[0])
PY
mkdir -p "$STAGE"
for file in runner/runner.mjs src/behavior.ts src/engine.ts src/persistence.ts ops/build-003.mjs; do
    curl -fLsS "$BASE/$file" -o "$STAGE/$(basename "$file")"
done
grep -q GENESIS_ALLOW_NEW_WORLD "$STAGE/runner.mjs" || fail "Wrong runner version"
grep -q MAX_LINEAGE "$STAGE/engine.ts" || fail "Wrong engine version"
guest 'sudo install -d -m 755 /opt/genesis/safety-staging'
tar -C "$STAGE" -cf - runner.mjs behavior.ts engine.ts persistence.ts build-003.mjs | guest 'sudo tar -xf - -C /opt/genesis/safety-staging'
guest 'sudo /opt/genesis/bin/node /opt/genesis/safety-staging/build-003.mjs /opt/genesis/safety-staging'
guest 'sudo chmod 644 /opt/genesis/safety-staging/*.mjs'
guest 'for f in runner.mjs behavior.mjs engine.mjs persistence.mjs world-engine.mjs; do /opt/genesis/bin/node --check /opt/genesis/safety-staging/$f || exit 1; done'
guest 'cd /opt/genesis/safety-staging && /opt/genesis/bin/node --input-type=module -' <<'JS'
import fs from 'node:fs';
import {restoreCheckpoint} from './persistence.mjs';
const w=restoreCheckpoint(JSON.parse(fs.readFileSync('/var/lib/genesis/experiment-004/world.json','utf8')));
if(w.seed!==404 || w.tick<100 || !Array.isArray(w.lineage))process.exit(1);
console.log('Existing checkpoint readable, tick:',w.tick);
JS
echo "PRECHECK OK - installing code only, leaving simulation stopped"
guest 'sudo install -m 644 /opt/genesis/safety-staging/runner.mjs /opt/genesis/runner/runner.mjs'
for f in behavior.mjs engine.mjs persistence.mjs world-engine.mjs; do
    guest "sudo install -m 644 /opt/genesis/safety-staging/$f /opt/genesis/runner/$f"
done
guest 'sudo install -d -m 755 /etc/systemd/system/genesis.service.d'
guest 'sudo tee /etc/systemd/system/genesis.service.d/90-safety.conf >/dev/null' <<'EOF'
[Service]
Environment=GENESIS_SAVE_MS=60000
EOF
guest 'sudo systemctl daemon-reload'
! systemctl is-active --quiet genesis-sample.timer || fail "Host timer unexpectedly active"
guest '! systemctl is-active --quiet genesis' || fail "Guest unexpectedly active"
sha256sum "$BACKUP/world-post-oom.json" "$BACKUP/old-runner.tar.gz" "$BACKUP/history-004.sqlite3" > "$BACKUP/SHA256SUMS"
echo "SAFETY CODE INSTALLED; Genesis remains STOPPED; original 004 history and post-OOM checkpoint saved."
echo "Backup: $BACKUP"
echo "Do NOT resume post-OOM 004 as original 004."
