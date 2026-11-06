# Experiment 001 → Experiment 002

This transition is **manual**, run as root from Proxmox host pve. It does
not change the VM 220 network, attach it to LAN, publish a website or permit
browser controls.

## Why

Experiment 001 is worth keeping even if predators have disappeared. The
current engine creates predators among the 32 founders and only produces
offspring of the same species. If all predators die out, they cannot
reappear without a new world or a changed engine. We keep the engine
unchanged so Experiment 002 is a comparable, independent seed (83).

## Before the switch

Verify `genesis.service` is running inside VM 220, the VM has a working
isolated SSH link from the host, and the 15-minute sampling service is
present on the host. Confirm there is sufficient free disk space.

Install and review `ops/start-experiment-002.sh` on host pve and execute
it as root. The script:

1. Stops the host's 15-minute timer and collector.
2. Gracefully stops the **runner service only**, allowing a final checkpoint.
3. Copies the original world checkpoint and its backup to a private archive
   on the Proxmox host, verifying SHA-256 and the checkpoint structure.
4. Preserves the existing SQLite measurement history separately.
5. Keeps the original world file **untouched inside the guest**.
6. Creates a new, separate checkpoint path for Experiment 002 with seed 83.
7. Starts the same engine code and records its first sample immediately.
8. Restarts the host's 15-minute sampling timer.

Important: the script *does* intentionally restart the Genesis runner so
that an independent world can begin; there is no safe way to reset and
create a fresh world without ending the original runtime. It does **not**
restart the Proxmox host or VM.

## Archive locations

- Host 001: `/root/genesis-experiments/experiment-001/world.json`
- Host 001 backup: `/root/genesis-experiments/experiment-001/world.json.bak` (if one existed)
- Host 001 measurements: `/root/genesis-experiments/experiment-001/history.sqlite3`
- VM 001 (original remains): `/var/lib/genesis/world.json`
- VM 002: `/var/lib/genesis/experiment-002/world.json`
- Host 002 live archive: `/var/lib/genesis-reports/history.sqlite3`

The archive is not a substitute for storage-level Proxmox backups. A full
historical reconstruction is limited to measurements already recorded.
Previous periods for which sampling was not active cannot be recovered.

## Recovery if startup fails

Do **not** delete either checkpoint. If the new service did not start and
Experiment 002 has no valid checkpoint, remove only the new drop-in,
reload systemd and restart the original service:

    ssh -i /root/.ssh/genesis_ed25519 genesis@10.220.0.2 \
      'sudo rm /etc/systemd/system/genesis.service.d/experiment-002.conf && sudo systemctl daemon-reload && sudo systemctl start genesis'

If the new world has started successfully, do not run the transition
script again; it deliberately refuses duplicate execution.

## Publication

The public view must clearly identify which experiment its current data
represents and avoid presenting 001 and 002 in one continuous chart.
Before public launch, configure versioned history access, GitHub reporting
and security review of the separate public tunnel. Do not make the VM
network route into LAN.
