import { Migration } from '@mikro-orm/migrations'


/**
 * Migration 4: `configBody` back to `text` on databases that ran migration 1 before 2026-11-12. Until then
 * step 6 of migration 1 converted the column to `json` (production's type); the C++ author's answers of
 * 2026-11-08 (Q27 and Q31 in `DbAgent/docs/08-questions-for-the-author.md`) made the schema doc
 * `Documentation/DB/DBTables/SVT_DB_Tables_SourceOfTruth.txt` authoritative, and it says `text`, so migration 1
 * now converts the other way. A database migrated after that change is already `text` and this is a no-op;
 * one migrated earlier still has `json` and is converted here, verbatim (`json` keeps the stored text, so
 * `::text` returns exactly what was written).
 *
 * Reasoning: `docs/db-agent-clone/02-database-migration.md` §2.
 */
export class Migration20261112000004_config_body_text extends Migration {

    override up(): void {
        for (const table of ['SvtTestSetupConfig', 'SvtTestTypeConfig']) {
            this.addSql(`
                DO $$ BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'main' AND table_name = '${table}' AND column_name = 'configBody'
                            AND data_type <> 'text'
                    ) THEN
                        ALTER TABLE main."${table}" ALTER COLUMN "configBody" TYPE text USING "configBody"::text;
                    END IF;
                END $$;
            `)
        }
    }

}
