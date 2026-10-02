# PA Manager 6969 — systemd units

The production services run from `/root/sheng/PA-manager-6969`. These unit files
used to live only in `/etc/systemd/system/`, which meant they were never
reviewed or version-controlled. They are now kept here as the source of truth.

## Units

| Unit | Type | Purpose |
|---|---|---|
| `pa-manager-6969-web.service` | simple | FastAPI Web + API on port 6969 (uvicorn) |
| `pa-manager-6969-runner.service` | simple | Cycle runner (independent worker) |
| `pa-manager-6969-bridge.service` | simple | Terminal bridge (node/ssh2, port 7002) |
| `pa-manager-6969-compact-events.service` | oneshot | Event retention: `compact_events.py --days 30 --apply --vacuum` |
| `pa-manager-6969-compact-events.timer` | timer | Runs the retention service twice a month (1st & 15th, 04:30) |

## Install / update

```bash
sudo cp deploy/systemd/pa-manager-6969-*.service deploy/systemd/pa-manager-6969-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pa-manager-6969-web.service pa-manager-6969-runner.service pa-manager-6969-bridge.service
sudo systemctl enable --now pa-manager-6969-compact-events.timer
```

## Event retention

`compact_events.py` is opt-in. Without `--apply` it only lists eligible jobs.
It collapses each terminal job older than `--days` to a single `COMPACTED` row
and never touches reports or evidence files.

`--vacuum` runs a SQLite `VACUUM` after the deletes commit, so the space freed
by compaction is returned to disk (a bare `DELETE` leaves the file size
unchanged).

Maintenance commands:

```bash
systemctl list-timers "pa-manager*"                          # next run
systemctl start pa-manager-6969-compact-events.service       # run once now
journalctl -u pa-manager-6969-compact-events -n 20           # logs
systemctl disable --now pa-manager-6969-compact-events.timer # stop the schedule
```

## Notes

- The paths above assume the canonical checkout at
  `/root/sheng/PA-manager-6969`; adjust `WorkingDirectory`, `ExecStart`, and the
  `CYCLE_INSTANCE`/bridge token paths if you deploy elsewhere.
- `CYCLE_INSTANCE=data/pa6969` is what makes `settings.py` resolve the DB at
  `data/pa6969/jobs.sqlite3`. Omitting it points maintenance at the wrong DB.
