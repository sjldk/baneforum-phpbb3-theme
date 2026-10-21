# local-data

Everything here except this file is ignored by git (see `/.gitignore`). It holds production copies used for testing. Never commit them.

| Folder | Put here |
|---|---|
| `db/` | Database backups (`*.sql.gz`) |
| `production/files/` | The production `files/` folder (attachments, physical file names) |
| `production/images/` | The production `images/` folder, or only `images/avatars/upload`, `images/ranks`, `images/smilies` |

The Docker test board will mount `production/` read-only in a later step.
