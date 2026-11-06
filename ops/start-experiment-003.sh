#!/usr/bin/env bash
# MANUAL one-way transition from Genesis Experiment 002 to 003 on pve only.
# Does not restart Proxmox, VM 220 or change networking/public exposure.
set -Eeuo pipefail
umask 077
HOST_STAGE=/root/genesis-exp003-stage
ARCHIVE=/root/genesis-experiments/experiment-002
DB_DIR=/var/lib/genesis-reports
KEY=/root/.ssh/genesis_ed25519
BASE=https://raw.githubusercontent.com/mtrccl/the-living-lab/experiment/predator-balance-benchmark
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=8 genesis@10.220.0.2)
guest() { "${SSH[@]}" "$@"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || fail "Run as root on Proxmox pve"
[[ -s "$KEY" ]] || fail "VM SSH key missing"
[[ ! -e "$ARCHIVE/world.json" ]] || fail "Experiment 002 already archived; refusing repeat"
guest 'test "$(hostname)" = genesis && sudo -n systemctl is-active --quiet genesis' ||
 fail "Guest 220 or genesis runner inactive"
[[ "$(curl -fsS http://127.0.0.1:3000/api/experiment | python3 -c 'import json,sys; print(json.load(sys.stdin)["experiment"])')" == 002 ]] ||
 fail "Dashboard does not report Experiment 002"
systemctl is-enabled --quiet genesis-sample.timer || fail "15-minute sampling timer not enabled"
[[ -s /opt/genesis-reporting/sample.py ]] || fail "Host sampler missing"

# Downloads and TEST COMPILATION happen while old world continues to live.
mkdir -p "$HOST_STAGE"
for file in runner/runner.mjs src/behavior.ts src/engine.ts src/persistence.ts ops/build-003.mjs; do
 curl -fLsS "$BASE/$file" -o "$HOST_STAGE/${file##*/}"
done
python3 - "$HOST_STAGE" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
for file in ["runner.mjs","behavior.ts","engine.ts","persistence.ts","build-003.mjs"]:
    assert (p/file).stat().st_size>100, file
assert 'predatorMetabolismFactor' in (p/'engine.ts').read_text()
assert 'GENESIS_CONFIG' in (p/'runner.mjs').read_text()
print("Source download validated")
PY

guest "/opt/genesis/bin/node -e 'if(typeof require(\"node:module\").stripTypeScriptTypes!==\"function\")process.exit(1)'" ||
 fail "Guest Node cannot strip TypeScript; 002 is untouched"
guest 'sudo install -d -m 755 /opt/genesis/experiment-003-staging'
tar -C "$HOST_STAGE" -cf - runner.mjs behavior.ts engine.ts persistence.ts build-003.mjs |
 guest 'sudo tar -xf - -C /opt/genesis/experiment-003-staging'
guest 'sudo /opt/genesis/bin/node /opt/genesis/experiment-003-staging/build-003.mjs /opt/genesis/experiment-003-staging'
# Archive transfer inherits restrictive host umask; grant read-only access to staged code.
guest 'sudo chmod 644 /opt/genesis/experiment-003-staging/*.mjs'
guest 'for file in runner.mjs behavior.mjs engine.mjs persistence.mjs world-engine.mjs; do /opt/genesis/bin/node --check /opt/genesis/experiment-003-staging/$file || exit; done'
guest '/opt/genesis/bin/node --input-type=module -e "import(\"/opt/genesis/experiment-003-staging/persistence.mjs\").then(({World,createCheckpoint,restoreCheckpoint})=>{let w=new World(303,{predatorMinPreyRatio:7,predatorMetabolismFactor:.3,predatorBirthEnergy:120});w.advance(100);let b=restoreCheckpoint(createCheckpoint(w));if(b.tick!==100||b.config.predatorMinPreyRatio!==7)process.exit(1);console.log(\"Staged engine validated\")})"' ||
 fail "Staged engine failed smoke test"

echo "Staging passed. Archiving Experiment 002 now..."
mkdir -p "$ARCHIVE"
chmod 700 "$ARCHIVE"
systemctl stop genesis-sample.timer
systemctl stop genesis-sample.service 2>/dev/null || true
# End old diagnostic if still running, to keep its CSV attached to 002.
systemctl stop genesis-diagnostic-002.service 2>/dev/null || true

guest 'sudo systemctl stop genesis'
guest 'sudo test -s /var/lib/genesis/experiment-002/world.json' ||
 fail "002 checkpoint missing after graceful stop; DO NOT run this script again"
guest 'sudo cat /var/lib/genesis/experiment-002/world.json' > "$ARCHIVE/world.json"
GUEST_HASH=$(guest 'sudo sha256sum /var/lib/genesis/experiment-002/world.json' | awk '{print $1}')
HOST_HASH=$(sha256sum "$ARCHIVE/world.json" | awk '{print $1}')
[[ "$GUEST_HASH" == "$HOST_HASH" ]] || fail "002 archive checksum mismatch"
python3 - "$ARCHIVE/world.json" <<'PY'
import json,sys
c=json.load(open(sys.argv[1],encoding="utf8"))
assert c["schemaVersion"]==1
assert c["world"]["tick"]>0
print("Archived Experiment 002 checkpoint at tick",c["world"]["tick"])
PY
if guest 'sudo test -s /var/lib/genesis/experiment-002/world.json.bak'; then
 guest 'sudo cat /var/lib/genesis/experiment-002/world.json.bak' > "$ARCHIVE/world.json.bak"
fi
guest 'sudo tar -C /opt/genesis/runner -czf - runner.mjs world-engine.mjs' > "$ARCHIVE/runner-002.tar.gz"
tar -tzf "$ARCHIVE/runner-002.tar.gz" >/dev/null
if [[ -f "$DB_DIR/history.sqlite3" ]]; then
 python3 - "$DB_DIR/history.sqlite3" "$ARCHIVE/history.sqlite3" <<'PY'
import sqlite3,sys
with sqlite3.connect(sys.argv[1]) as source, sqlite3.connect(sys.argv[2]) as dest:
    source.backup(dest)
with sqlite3.connect(sys.argv[2]) as db:
    assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
print("Experiment 002 SQLite archived and checked")
PY
 mv "$DB_DIR/history.sqlite3" "$ARCHIVE/history-original.sqlite3"
fi
if [[ -f "$DB_DIR/diagnostics-002.csv" ]]; then
 cp -a "$DB_DIR/diagnostics-002.csv" "$ARCHIVE/diagnostics-002.csv"
fi
date -u +%FT%TZ > "$ARCHIVE/archived-at.txt"

echo "Checkpoint verified. Activating new engine and world..."
guest 'sudo install -d -m 750 -o genesis -g genesis /var/lib/genesis/experiment-003'
guest 'sudo test ! -e /var/lib/genesis/experiment-003/world.json' ||
 fail "003 checkpoint already exists; aborting"
# Use install rather than cp -a: do NOT carry restrictive staging permissions into the live service.
guest 'sudo install -m 644 /opt/genesis/experiment-003-staging/runner.mjs /opt/genesis/runner/runner.mjs'
for file in behavior.mjs engine.mjs persistence.mjs world-engine.mjs; do
 guest "sudo install -m 644 /opt/genesis/experiment-003-staging/$file /opt/genesis/runner/$file"
done

guest 'sudo mkdir -p /etc/systemd/system/genesis.service.d /etc/genesis'
guest 'sudo tee /etc/genesis/experiment-003.env >/dev/null' <<'EOF'
GENESIS_CHECKPOINT=/var/lib/genesis/experiment-003/world.json
GENESIS_SEED=303
GENESIS_CONFIG='{"foodRate":2.5,"mutation":0.12,"temperature":0.5,"maxPopulation":350,"predatorExtraCost":0.03,"predatorCatchRadius":14,"predatorSpeedMultiplier":1.5,"predatorInitialEnergy":115,"predatorKillGain":80,"grazerAlertMultiplier":0.3,"predatorMinPreyRatio":7,"predatorMetabolismFactor":0.3,"predatorBirthEnergy":120}'
EOF
guest 'sudo chmod 600 /etc/genesis/experiment-003.env'
guest 'sudo tee /etc/systemd/system/genesis.service.d/experiment-003.conf >/dev/null' <<'EOF'
[Service]
EnvironmentFile=/etc/genesis/experiment-003.env
EOF
guest 'sudo test -e /etc/systemd/system/genesis.service.d/experiment-002.conf && sudo mv /etc/systemd/system/genesis.service.d/experiment-002.conf /etc/systemd/system/genesis.service.d/experiment-002.conf.disabled || true'
guest 'sudo systemctl daemon-reload && sudo systemctl start genesis'
guest 'sudo systemctl is-active --quiet genesis'
guest 'curl -fsS http://127.0.0.1:8095/state' |
 python3 -c 'import json,sys; d=json.load(sys.stdin);w=d["world"];assert w["seed"]==303;assert w["tick"]<100;assert w["config"]["predatorMinPreyRatio"]==7;assert w["config"]["predatorBirthEnergy"]==120;print("003 running:",d["stats"])'
# Capture initial 003 observation, then enable 15-minute intervals.
python3 /opt/genesis-reporting/sample.py
printf '003\n' > "$DB_DIR/active-experiment.txt"
chmod 644 "$DB_DIR/active-experiment.txt"
systemctl start genesis-sample.timer
curl -fsS http://127.0.0.1:3000/api/experiment
echo
echo "Experiment 003 active. Experiment 002 archive: $ARCHIVE"
echo "If a command failed AFTER 002 was stopped, do not rerun. Diagnose/restore 002 first."
