import { Migration } from '@mikro-orm/migrations'


/**
 * Migration 1: bring the production layout (migration 0) to the dev layout, then add what the
 * re-implementation needs. Every step is guarded, so it also runs on a database that already has the dev
 * layout (dev) or that was created empty by migration 0.
 *
 * Content and reasoning: `docs/02-database-migration.md` §1 and §2.
 *
 * 1-6: the September 2026 `SvtTestList` changes dev already has (rename `createsAt`, the `dutEntityName` and
 *      `testResultStatus` enums, the two `SvtTestListToEntity*` tables, the `testSetupConfigId` FK, the drop of
 *      the three old per-DUT link tables, `configBody` as `text`).
 * 7-8: surrogate `id` on the history tables and `SvtTestTemplate.testTypeConfigId` NOT NULL.
 */
export class Migration20261108000001_dev_layout_and_surrogate_ids extends Migration {

    override up(): void {
        // 1. SvtTestList.createsAt -> createdAt
        this.addSql(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'main' AND table_name = 'SvtTestList' AND column_name = 'createsAt'
                ) THEN
                    ALTER TABLE main."SvtTestList" RENAME COLUMN "createsAt" TO "createdAt";
                END IF;
            END $$;
        `)

        // 2. the two enums that only dev had
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."dutEntityName" AS ENUM ('Asic', 'Chip', 'ChipBlock');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."testResultStatus" AS ENUM ('SUCCESS', 'PARTIAL_SUCCESS', 'FAILURE', 'ERROR');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)

        // 3. the per-test DUT link tables of the dev layout (constraint names as in the dev dump)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtTestListToEntityName" (
                "testId" integer NOT NULL,
                "dutEntityName" main."dutEntityName" NOT NULL,
                CONSTRAINT "SvtTestListToEntityName_pkey" PRIMARY KEY ("dutEntityName", "testId"),
                CONSTRAINT "SvtTestListToEntityName_testId_fkey" FOREIGN KEY ("testId")
                    REFERENCES main."SvtTestList"(id) DEFERRABLE
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtTestListToEntityId" (
                "testId" integer NOT NULL,
                "dutId" integer NOT NULL,
                CONSTRAINT "SvtTestListToEntityId_testId_fkey" FOREIGN KEY ("testId")
                    REFERENCES main."SvtTestList"(id) DEFERRABLE
            );
        `)

        // 4. SvtTestList: testSetupConfigId required with its FK; testResultStatus becomes the enum
        this.addSql('ALTER TABLE main."SvtTestList" ALTER COLUMN "testSetupConfigId" SET NOT NULL;')
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestList"'::regclass AND conname = 'SvtTestList_testSetupConfigId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestList"
                        ADD CONSTRAINT "SvtTestList_testSetupConfigId_fkey" FOREIGN KEY ("testSetupConfigId")
                        REFERENCES main."SvtTestSetupConfig"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'main' AND table_name = 'SvtTestList' AND column_name = 'testResultStatus'
                        AND udt_name <> 'testResultStatus'
                ) THEN
                    ALTER TABLE main."SvtTestList"
                        ALTER COLUMN "testResultStatus" TYPE main."testResultStatus"
                        USING "testResultStatus"::main."testResultStatus";
                END IF;
            END $$;
        `)

        // 5. the old per-DUT link tables, dropped only while empty
        for (const table of ['SvtAsicTestList', 'SvtChipTestList', 'SvtChipBlockTestList']) {
            this.addSql(`
                DO $$ DECLARE n bigint; BEGIN
                    IF to_regclass('main."${table}"') IS NOT NULL THEN
                        EXECUTE 'SELECT count(*) FROM main."${table}"' INTO n;
                        IF n > 0 THEN
                            RAISE EXCEPTION 'main."${table}" has % rows; move them to SvtTestListToEntity* before dropping it', n;
                        END IF;
                        DROP TABLE main."${table}";
                    END IF;
                END $$;
            `)
        }

        // 6. configBody is text everywhere, as the schema doc the author declares authoritative says (Q27, Q31;
        //    prod stored json). `json` keeps the stored text, so `::text` converts verbatim. Until 2026-11-12 this
        //    step converted the other way; migration 4 repeats this conversion for databases migrated before that.
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

        // 7. surrogate ids on the history tables (MikroORM needs a primary key; also a stable order)
        const historyTables = [
            'WaferLocation',
            'ChipLocation',
            'EquipmentLocation',
            'ModuleLocation',
            'WaferLoadedInMachine',
            'ProbeCardInstalledInMachine',
            'SvtTestListToEntityId',
        ]
        for (const table of historyTables) {
            this.addSql(`
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'main' AND table_name = '${table}' AND column_name = 'id'
                    ) THEN
                        ALTER TABLE main."${table}" ADD COLUMN id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY;
                    END IF;
                END $$;
            `)
        }

        // 8. SvtTestTemplate.testTypeConfigId is required (no NULLs exist in either dump)
        this.addSql('ALTER TABLE main."SvtTestTemplate" ALTER COLUMN "testTypeConfigId" SET NOT NULL;')
    }

}
