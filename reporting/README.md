# Daily ecosystem reporting

This proposed collector reads the live Genesis world through the existing **read-only** HTTP API forwarded to the Proxmox host at 127.0.0.1:18095. It does not change the simulation or its checkpoint files.

Outputs:
- latest.json: the newest observation
- one timestamped JSON report per invocation
- latest observation tick, population, generation, food, births, deaths and energy
- delta births/deaths/population since the preceding successful observation; no invented historical data

Test from repository root:

    python3 -m unittest reporting.test_daily

After review, copy reporting/daily.py to the Proxmox host, then manually test:

    python3 daily.py --output /var/lib/genesis-reports

Optional host-side systemd timer at 21:00 UTC every day:

genesis-report.service:

    [Unit]
    Description=Genesis daily read-only observation
    After=genesis-link.service
    Wants=genesis-link.service

    [Service]
    Type=oneshot
    ExecStart=/usr/bin/python3 /opt/genesis-reporting/daily.py --output /var/lib/genesis-reports

genesis-report.timer:

    [Unit]
    Description=Capture Genesis daily observation

    [Timer]
    OnCalendar=*-*-* 21:00:00 UTC
    Persistent=true
    Unit=genesis-report.service

    [Install]
    WantedBy=timers.target

These reports are **local only** until a restricted GitHub publisher to a separate data branch is designed and approved. No GitHub secrets belong in the isolated VM. Nothing in this PR is automatically installed on Proxmox.

## 15-minute samples for the historical charts

The optional collector `reporting/sample.py` creates a compact local SQLite archive.
One observation per quarter-hour UTC includes the full population totals, grazer/predator
counts, food, mean energy, six energy bands and four generation bands. It never stores
a complete world snapshot or modifies the simulation. The historical dashboard
(PR #10) reads this database read-only, and all five charts offer 1 hour, 1 day,
1 week, 1 month, and 1 year. Periods with no samples remain empty; history does
not magically predate installation. Longer ranges are aggregated for readability.

Test:

    python3 -m unittest reporting.test_sample

After review, copy `reporting/sample.py` to
`/opt/genesis-reporting/sample.py` on the Proxmox host.
With the existing `genesis-link.service` healthy, run once:

    python3 /opt/genesis-reporting/sample.py
    ls -lh /var/lib/genesis-reports/history.sqlite3

Then create these **host-side** systemd units (not inside VM 220).

`/etc/systemd/system/genesis-sample.service`:

    [Unit]
    Description=Genesis 15-minute read-only observation
    After=genesis-link.service
    Wants=genesis-link.service

    [Service]
    Type=oneshot
    ExecStart=/usr/bin/python3 /opt/genesis-reporting/sample.py

`/etc/systemd/system/genesis-sample.timer`:

    [Unit]
    Description=Sample Genesis every 15 minutes

    [Timer]
    OnCalendar=*-*-* *:00,15,30,45:00
    Persistent=true
    Unit=genesis-sample.service

    [Install]
    WantedBy=timers.target

Activate only after successful manual testing:

    systemctl daemon-reload
    systemctl enable --now genesis-sample.timer
    systemctl list-timers genesis-sample.timer

The timer records **actual** observations; a missed interval is not reconstructed
from fabricated values. Keep the Proxmox-host archive outside of the VM.
The separate daily Markdown/JSON-to-GitHub publisher is still a future change;
no GitHub credentials are required for sampling.
