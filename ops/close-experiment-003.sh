#!/usr/bin/env bash
# Close Experiment 003 safely on pve. No automatic start of Experiment 004.
set -Eeuo pipefail
umask 077
A=/root/genesis-experiments/experiment-003
DB=/var/lib/genesis-reports/history.sqlite3
MARK=/var/lib/genesis-reports/active-experiment.txt
SSH=(ssh -i /root/.ssh/genesis_ed25519 -o BatchMode=yes -o ConnectTimeout=8 genesis@10.220.0.2)
guest() { "${SSH[@]}" "$@"; }
fail() { echo "ERROR: $*" >&2; exit 1; }
[[ $(id -u) == 0 ]] || fail "Run as root on pve"
[[ -s /root/.ssh/genesis_ed25519 ]] || fail "SSH key missing"
[[ $(cat "$MARK") == 003 ]] || fail "Experiment marker is not 003"
[[ ! -e "$A" ]] || fail "Archive exists; refusing overwrite"
[[ -s "$DB" ]] || fail "History DB missing"
guest 'test "$(hostname)" = genesis && sudo -n systemctl is-active --quiet genesis' || fail "VM genesis is not running"
python3 - "$DB" <<'PY'
import sqlite3,sys
with sqlite3.connect(sys.argv[1]) as db:
    assert db.execute("PRAGMA quick_check").fetchone()[0]=="ok"
    n=db.execute("SELECT COUNT(*) FROM observations").fetchone()[0]
    assert n>0
    print("Preflight: historical measurements =",n)
PY
systemctl disable --now genesis-sample.timer
systemctl stop genesis-sample.service 2>/dev/null || true
guest 'sudo systemctl disable --now genesis'
guest 'sudo test -s /var/lib/genesis/experiment-003/world.json' || fail "Final checkpoint unavailable; do not rerun"
mkdir -m 700 "$A"
guest 'sudo cat /var/lib/genesis/experiment-003/world.json' > "$A/world.json"
R=$(guest 'sudo sha256sum /var/lib/genesis/experiment-003/world.json' | awk '{print $1}')
L=$(sha256sum "$A/world.json" | awk '{print $1}')
[[ "$R" == "$L" ]] || fail "Checkpoint hash mismatch; do not rerun"
if guest 'sudo test -s /var/lib/genesis/experiment-003/world.json.bak'; then
    guest 'sudo cat /var/lib/genesis/experiment-003/world.json.bak' > "$A/world.json.bak"
fi
guest 'sudo tar -C /opt/genesis/runner -czf - runner.mjs world-engine.mjs engine.mjs behavior.mjs persistence.mjs' > "$A/engine-003.tar.gz"
tar -tzf "$A/engine-003.tar.gz" >/dev/null
guest 'sudo cat /etc/genesis/experiment-003.env' > "$A/config-003.env"
python3 - "$DB" "$A/history.sqlite3" <<'PY'
import sqlite3,sys
with sqlite3.connect(sys.argv[1]) as src, sqlite3.connect(sys.argv[2]) as dest:
    src.backup(dest)
with sqlite3.connect(sys.argv[2]) as db:
    assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
    print("Archived measurements:",db.execute("SELECT COUNT(*) FROM observations").fetchone()[0])
PY
python3 - "$A/world.json" <<'PY'
import json,sys
c=json.load(open(sys.argv[1],encoding="utf8"))
assert c["schemaVersion"]==1
w=c["world"]
assert w["seed"]==303
assert len(w["organisms"])==0
print("Final tick:",w["tick"],"births:",w["births"],"deaths:",w["deaths"])
for species in ("grazer","predator"):
    died=[a["diedTick"] for a in w["lineage"] if a["species"]==species and a["diedTick"] is not None]
    print(species,"last death tick:",max(died) if died else None)
PY
date -u +%FT%TZ > "$A/closed-at-utc.txt"
sha256sum "$A/world.json" "$A/history.sqlite3" "$A/engine-003.tar.gz" > "$A/SHA256SUMS"
printf '003-closed\n' > "$MARK"
chmod 644 "$MARK"
echo "EXPERIMENT 003 CLOSED; archive: $A"
echo "genesis.service and genesis-sample.timer disabled; VM 220 unaffected"
