#!/usr/bin/env bash
# MANUAL launch of Genesis Experiment 004 from a verified, archived 003 state.
# Does not modify the archived 001/002/003 checkpoints or reboot VM 220.
set -Eeuo pipefail
umask 077
KEY=/root/.ssh/genesis_ed25519
A=/root/genesis-experiments/experiment-003
STAGE=/root/genesis-exp004-stage
DB=/var/lib/genesis-reports/history.sqlite3
MARK=/var/lib/genesis-reports/active-experiment.txt
BASE=https://raw.githubusercontent.com/mtrccl/the-living-lab/research/experiment-004-root-cause
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=8 genesis@10.220.0.2)
guest() { "${SSH[@]}" "$@"; }
fail() { echo "ERROR: $*" >&2; exit 1; }
[[ "$(id -u)" == 0 ]] || fail "Run on pve as root"
[[ -s "$KEY" && -s "$A/world.json" && -s "$A/history.sqlite3" && -s "$A/SHA256SUMS" ]] || fail "003 archive incomplete"
[[ "$(cat "$MARK")" == "003-closed" ]] || fail "003 not marked closed"
[[ -s "$DB" ]] || fail "003 original history missing"
[[ ! -e "$A/history-original-at-004.sqlite3" ]] || fail "003 original history already moved"
[[ ! -e /var/lib/genesis-reports/history-004-staging.sqlite3 ]] || fail "004 staging history already exists"
[[ ! -e /root/genesis-experiments/experiment-004 ]] || fail "004 archive already exists"
(cd "$A" && sha256sum -c SHA256SUMS) || fail "003 archive SHA mismatch"
guest 'test "$(hostname)" = genesis && ! systemctl is-active --quiet genesis && ! systemctl is-enabled --quiet genesis' ||
 fail "Genesis service should be disabled and stopped"
! systemctl is-active --quiet genesis-sample.timer || fail "Sampler timer is active"
guest 'sudo test ! -e /var/lib/genesis/experiment-004/world.json' || fail "004 already exists on VM"
python3 - "$DB" <<'PY'
import sqlite3,sys
with sqlite3.connect(sys.argv[1]) as db:
 assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
 assert db.execute("SELECT COUNT(*) FROM observations").fetchone()[0]>0
print("Existing 003 history checked")
PY

# Everything below through the smoke test runs while Genesis is still stopped.
mkdir -p "$STAGE"
for file in runner/runner.mjs src/behavior.ts src/engine.ts src/persistence.ts ops/build-003.mjs; do
 curl -fLsS "$BASE/$file" -o "$STAGE/${file##*/}"
done
python3 - "$STAGE" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
for name in ["runner.mjs","behavior.ts","engine.ts","persistence.ts","build-003.mjs"]:
 assert (p/name).stat().st_size>100,name
assert "predatorCatchChance" in (p/"engine.ts").read_text()
assert "predatorCatchChance" in (p/"runner.mjs").read_text()
PY
guest 'sudo install -d -m 755 /opt/genesis/experiment-004-staging'
tar -C "$STAGE" -cf - runner.mjs behavior.ts engine.ts persistence.ts build-003.mjs |
 guest 'sudo tar -xf - -C /opt/genesis/experiment-004-staging'
guest 'sudo /opt/genesis/bin/node /opt/genesis/experiment-004-staging/build-003.mjs /opt/genesis/experiment-004-staging'
guest 'sudo chmod 644 /opt/genesis/experiment-004-staging/*.mjs'
guest 'for f in runner.mjs behavior.mjs engine.mjs persistence.mjs world-engine.mjs; do /opt/genesis/bin/node --check /opt/genesis/experiment-004-staging/$f || exit; done'
guest '/opt/genesis/bin/node --input-type=module -e "
import {World,createCheckpoint,restoreCheckpoint} from \"/opt/genesis/experiment-004-staging/persistence.mjs\";
const w=new World(404,{predatorCatchChance:0.6,preyRefugeWidth:0});
w.advance(100);
if(w.config.predatorCatchChance!==0.6||JSON.stringify(restoreCheckpoint(createCheckpoint(w)).snapshot())!==JSON.stringify(w.snapshot()))process.exit(1);
console.log(\"004 staged engine OK\");
"'
echo "PRECHECK OK — activating 004; never rerun script after this point."

guest 'sudo install -d -m 750 -o genesis -g genesis /var/lib/genesis/experiment-004'
guest 'sudo install -m 644 /opt/genesis/experiment-004-staging/runner.mjs /opt/genesis/runner/runner.mjs'
for f in behavior.mjs engine.mjs persistence.mjs world-engine.mjs; do
 guest "sudo install -m 644 /opt/genesis/experiment-004-staging/$f /opt/genesis/runner/$f"
done
guest 'sudo install -d -m 755 /etc/genesis /etc/systemd/system/genesis.service.d'
guest 'sudo tee /etc/genesis/experiment-004.env >/dev/null' <<'EOF'
GENESIS_CHECKPOINT=/var/lib/genesis/experiment-004/world.json
GENESIS_SEED=404
GENESIS_CONFIG='{"foodRate":2.5,"mutation":0.12,"temperature":0.5,"maxPopulation":350,"predatorExtraCost":0.03,"predatorCatchRadius":14,"predatorSpeedMultiplier":1.5,"predatorInitialEnergy":115,"predatorKillGain":80,"grazerAlertMultiplier":0.3,"predatorMinPreyRatio":7,"predatorMetabolismFactor":0.3,"predatorBirthEnergy":120,"preyRefugeWidth":0,"predatorCatchChance":0.6}'
EOF
guest 'sudo chmod 600 /etc/genesis/experiment-004.env'
guest 'sudo tee /etc/systemd/system/genesis.service.d/experiment-004.conf >/dev/null' <<'EOF'
[Service]
EnvironmentFile=/etc/genesis/experiment-004.env
EOF
guest 'sudo test ! -e /etc/systemd/system/genesis.service.d/experiment-003.conf || sudo mv /etc/systemd/system/genesis.service.d/experiment-003.conf /etc/systemd/system/genesis.service.d/experiment-003.conf.disabled'
guest 'sudo systemctl daemon-reload'
# Keep original 003 DB in its own archive, and prepare a new clean 004 DB.
mv "$DB" "$A/history-original-at-004.sqlite3"
guest 'sudo systemctl enable --now genesis'
guest 'sudo systemctl is-active --quiet genesis'
guest 'curl -fsS http://127.0.0.1:8095/state' | python3 -c '
import json,sys
d=json.load(sys.stdin);w=d["world"];c=w["config"]
assert w["seed"]==404 and w["tick"]<200 and c["predatorCatchChance"]==0.6 and c["preyRefugeWidth"]==0
assert d["stats"]["predators"]>0 and d["stats"]["grazers"]>0
print("004 STARTED:",d["stats"])
'
python3 /opt/genesis-reporting/sample.py --db /var/lib/genesis-reports/history-004-staging.sqlite3
mv /var/lib/genesis-reports/history-004-staging.sqlite3 "$DB"
printf '004\n' > "$MARK"
chmod 644 "$MARK"
systemctl enable --now genesis-sample.timer
systemctl is-active --quiet genesis-sample.timer
echo "EXPERIMENT 004 RUNNING — 003 archive remains at $A"
echo "Never rerun this script; investigate any error after PRECHECK OK."
