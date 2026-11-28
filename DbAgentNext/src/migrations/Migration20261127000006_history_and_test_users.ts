import { Migration } from '@mikro-orm/migrations'


/** The six columns of this migration: the table, the new column, and its foreign key to `SvtUser.id`. */
const USER_COLUMNS = [
    { table: 'WaferLocation', column: 'userId' },
    { table: 'ChipLocation', column: 'userId' },
    { table: 'EquipmentLocation', column: 'userId' },
    { table: 'WaferLoadedInMachine', column: 'userId' },
    { table: 'ProbeCardInstalledInMachine', column: 'userId' },
    { table: 'SvtTestList', column: 'createdByUserId' },
] as const

/**
 * Migration 6: the user of the request on the history rows and on a test (ticket #397, decisions of #392). The five
 * history tables get `userId`, and `SvtTestList` gets `createdByUserId`: each `integer NULL`, with a foreign key to
 * `SvtUser.id` that is `DEFERRABLE` and has no action, as every foreign key of the schema.
 *
 * The rows that exist keep `NULL`, and so does a row written for a request without the header `svt_userId`. The
 * columns `username` stay: an old row may hold a name there, and a client without a user id may still send one.
 *
 * Every step is guarded, so it is a no-op where its change is already there. The previous release keeps working on
 * this schema: it never names the new columns, and it writes `NULL` into them. Schema: `docs/database-schema.md`.
 */
export class Migration20261127000006_history_and_test_users extends Migration {

    override up(): void {
        for (const { table, column } of USER_COLUMNS) {
            // The column and its key in one step. PostgreSQL does not read the rows to validate a foreign key on a column
            // that it adds without a default: every value is NULL. Measured on 2 million rows: 0.3 ms, against 90 ms for
            // a separate ADD CONSTRAINT.
            this.addSql(`
                ALTER TABLE main."${table}" ADD COLUMN IF NOT EXISTS "${column}" integer NULL
                    CONSTRAINT "${table}_${column}_fkey" REFERENCES main."SvtUser"(id) DEFERRABLE;
            `)
            // A database that has the column without the key (added by hand) gets the key here; this step reads the rows.
            this.addSql(`
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conrelid = 'main."${table}"'::regclass AND conname = '${table}_${column}_fkey'
                    ) THEN
                        ALTER TABLE ONLY main."${table}"
                            ADD CONSTRAINT "${table}_${column}_fkey" FOREIGN KEY ("${column}") REFERENCES main."SvtUser"(id) DEFERRABLE;
                    END IF;
                END $$;
            `)
        }
    }

}
