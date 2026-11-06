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
