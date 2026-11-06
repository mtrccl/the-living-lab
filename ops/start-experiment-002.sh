#!/usr/bin/env bash
# Root on Proxmox pve ONLY. Preserve world 001 before creating world 002.
set -Eeuo pipefail
umask 077
KEY=/root/.ssh/genesis_ed25519
ARCHIVE=/root/genesis-experiments/experiment-001
REPORTS=/var/lib/genesis-reports
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=8 genesis@10.220.0.2)
guest() { "${SSH[@]}" "$@"; }

[[ "$(id -u)" == 0 ]] || { echo 'Must run as root' >&2; exit 1; }
[[ -s "$KEY" && ! -e "$ARCHIVE/world.json" ]] || { echo 'Missing key or archive already exists' >&2; exit 1; }
guest 'test "$(hostname)" = genesis && sudo -n systemctl is-active --quiet genesis'
if guest 'sudo systemctl cat genesis' | grep -q 'GENESIS_CHECKPOINT=.*experiment-002'; then
 echo 'World 002 already configured; refusing duplicate transition' >&2; exit 1
fi
mkdir -p "$ARCHIVE"
chmod 700 "$ARCHIVE"
systemctl stop genesis-sample.timer 2>/dev/null || true
systemctl stop genesis-sample.service 2>/dev/null || true

echo 'Gracefully stopping runner to save world 001...'
guest 'sudo systemctl stop genesis'
guest 'sudo test -s /var/lib/genesis/world.json'
guest 'sudo cat /var/lib/genesis/world.json' > "$ARCHIVE/world.json"
if guest 'sudo test -s /var/lib/genesis/world.json.bak'; then
 guest 'sudo cat /var/lib/genesis/world.json.bak' > "$ARCHIVE/world.json.bak"
fi
GUEST_HASH=$(guest 'sudo sha256sum /var/lib/genesis/world.json' | awk '{print $1}')
HOST_HASH=$(sha256sum "$ARCHIVE/world.json" | awk '{print $1}')
[[ "$GUEST_HASH" == "$HOST_HASH" ]] || { echo 'Checksum mismatch; aborting' >&2; exit 1; }
python3 - "$ARCHIVE/world.json" <<'PY'
import json,sys
c=json.load(open(sys.argv[1], encoding="utf-8"))
assert c.get("schemaVersion")==1 and isinstance(c.get("world"),dict)
assert c["world"].get("tick",0)>0
print("Experiment 001 safely captured at tick", c["world"]["tick"])
PY

# Preserve the history without overwriting earlier experiments.
if [[ -f "$REPORTS/history.sqlite3" ]]; then
 python3 - "$REPORTS/history.sqlite3" "$ARCHIVE/history.sqlite3" <<'PY'
import sqlite3,sys
with sqlite3.connect(sys.argv[1]) as src, sqlite3.connect(sys.argv[2]) as dst:
    src.backup(dst)
with sqlite3.connect(sys.argv[2]) as db:
    assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
PY
 mv "$REPORTS/history.sqlite3" "$ARCHIVE/history-original.sqlite3"
fi
date -u +%FT%TZ > "$ARCHIVE/archived-at.txt"

# Keep old guest checkpoint untouched. New world uses its own location.
guest 'sudo install -d -o genesis -g genesis -m 750 /var/lib/genesis/experiment-002'
guest 'sudo mkdir -p /etc/systemd/system/genesis.service.d'
guest 'sudo tee /etc/systemd/system/genesis.service.d/experiment-002.conf >/dev/null' <<'EOF'
[Service]
Environment=GENESIS_CHECKPOINT=/var/lib/genesis/experiment-002/world.json
Environment=GENESIS_SEED=83
EOF
guest 'sudo systemctl daemon-reload && sudo systemctl start genesis'
guest 'sudo systemctl is-active --quiet genesis'
guest 'curl -fsS http://127.0.0.1:8095/state' | python3 -c 'import json,sys; print("Experiment 002:",json.load(sys.stdin)["stats"])'
if [[ -f /opt/genesis-reporting/sample.py ]]; then
 python3 /opt/genesis-reporting/sample.py
fi
# Marker is written only after the new runner is healthy.
printf '002\n' > "$REPORTS/active-experiment.txt"
chmod 644 "$REPORTS/active-experiment.txt"
systemctl start genesis-sample.timer 2>/dev/null || true
echo '001 archived; 002 running. VM and LAN bridge settings unchanged.'
