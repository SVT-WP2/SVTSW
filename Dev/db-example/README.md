# Example database dumps

PostgreSQL custom-format dumps of the SVT database (`pg_dump -Fc`), for local development and as
the reference for [DbAgent/docs/03-database-schema.md](../../DbAgent/docs/03-database-schema.md).
They contain schema **and data**.

| File | Source database | Taken | Dumped with | Archive format | Contents |
|---|---|---|---|---|---|
| `2026-11-08-backup_prod.dump` | `svt_sw_db` (production) | 2026-11-08 13:36 | pg_dump 18.6 from PostgreSQL 17.10 | 1.16 | 1 wafer type (ER2), 12 wafers, 41 052 ASICs, 2 probe cards, 1 prober, 6 probe projects. Chip, module, equipment and test tables empty. |
| `2026-11-08-backup.dump` | `svt_sw_db_test` (dev) | 2026-11-08 13:29 | pg_dump 18.6 from PostgreSQL 17.10 | 1.16 | Same wafers plus ER1 and AncMPW2 wafer types, 48 910 ASICs, and fixtures for chips, blocks, equipment, test setups, types, templates and tests. |
| `db-example-2026-06-01.dump` | production | 2026-06-01 | pg_dump 17 | 1.15 | Historical. Superseded by the two above. |

The two 2026-11-08 databases do **not** have the same schema. Dev matches the DB Agent code on
`master`; prod has not received the `SvtTestList` changes of September 2026 (`createdAt`, the
`SvtTestListToEntityName` / `…Id` tables, the `dutEntityName` and `testResultStatus` enums, the FK on
`testSetupConfigId`) and stores `configBody` as `json` where dev has `text`. The full list is in
[DbAgent/docs/03 §5](../../DbAgent/docs/03-database-schema.md#5-where-dump-doc-and-code-disagree);
row counts and what the data contains are in
[03 §7](../../DbAgent/docs/03-database-schema.md#7-data-in-the-2026-11-08-dumps).

## Restoring

`pg_restore` 17.0 reads the 1.16 archives written by pg_dump 18 without complaint. With the
containerised Postgres from [../README.md](../README.md) (user `postgres`, port 5500):

```bash
pg_restore --no-owner --no-privileges -h localhost -p 5500 -U postgres -d svt_sw_db Dev/db-example/2026-11-08-backup_prod.dump
```

Into an empty database, both dumps restore cleanly. To restore the dev dump over the prod dump
first drop the database; the schemas conflict.

## Reading without a database

`pg_restore` can emit the schema or the data as SQL text, which is enough for diffs and audits:

```bash
pg_restore --schema-only --no-owner --no-privileges -f schema-prod.sql Dev/db-example/2026-11-08-backup_prod.dump
```

```bash
pg_restore --data-only --no-owner --no-privileges -f data-prod.sql Dev/db-example/2026-11-08-backup_prod.dump
```

The data file is `COPY … FROM stdin;` blocks, one row per line, tab-separated, `\N` for NULL,
terminated by `\.`.

## Refreshing

Take new dumps with `pg_dump -Fc --no-owner --no-privileges -d <db> -f <date>-backup[_prod].dump`,
add them here with the date prefix, and update the table above and the schema doc's §5 and §7.
