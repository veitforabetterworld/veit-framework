# Sicherung vor der Migration

Jeder Host ruft im Runtime-Reload `scripts/deploy/backup-before-migrate.sh` auf, direkt bevor seine Migrationen laufen. Schlägt die Sicherung fehl oder ist der Dump nicht lesbar, bricht der Deploy ab, bevor etwas migriert wird.

Ablage: `/var/backups/veit/<name>/<name>-<zeitstempel>/` (nur root lesbar, außerhalb des Repos, damit `rsync --delete` sie nicht löscht). Die neuesten 10 bleiben liegen.

| Datei | Inhalt |
|---|---|
| `db.dump` | ganze Datenbank, `pg_dump -Fc --no-owner` |
| `state.tar.gz` | `.env`- und Config-Dateien mit den Schlüsseln. Ohne sie sind die `enc1:`-Werte im Dump nicht lesbar. |
| `MANIFEST` | Commit, Zeit, Größen, sha256 |

| Host | Name | Datenbank aus | Dateien |
|---|---|---|---|
| sprachassistent | `sprachassistent` | `.env` `DATABASE_URL` | `.env` |
| plenivo | `plenivo` | `apps/api/.env` `DATABASE_URL` | `apps/api/.env` |
| hochwasserdienst | `hochwasserdienst` | `.env` `DATABASE_URL` | `.env` |
| ScanGut | `scangut` | `config` `database.url` | `config/scangut.local.json`, `config/gmail-kaufland-imap.json`, `.env` |

Datei-Ablagen (z. B. plenivo `apps/api/storage`) fasst die Migration nicht an; sie sind nicht Teil dieser Sicherung.

## Wiederherstellen

App stoppen, dann:

```bash
B=/var/backups/veit/plenivo/plenivo-20261108-120000
pm2 stop plenivo-api
tar -xzf "$B/state.tar.gz" -C /root/plenivo          # nur wenn die Schlüssel ebenfalls zurück sollen
pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$DATABASE_URL" "$B/db.dump"
```

Danach den alten Stand des Codes deployen (der neue liest nur das migrierte Format) und die App starten.
