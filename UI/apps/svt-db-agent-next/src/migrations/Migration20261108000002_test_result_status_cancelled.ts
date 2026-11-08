import { Migration } from '@mikro-orm/migrations'


/**
 * Migration 2: `CANCELLED` joins the `testResultStatus` enum (decided 2026-11-08). The UI shows a Cancelled
 * status and the contract enum `EpicSvtTestResultStatus` mirrors the database's values, so a cancelled run
 * needs a stored value. Idempotent (`IF NOT EXISTS`); PostgreSQL ≥ 12 accepts `ADD VALUE` inside a
 * transaction (the new value is usable once the transaction has committed, which no migration needs).
 *
 * `libs/svt-db/data/src/enums/svt-db-enum-values.ts` lists the value as well: it is the snapshot the entities
 * declare, the live catalog is what `GetAllEnums` and the handlers' checks read.
 */
export class Migration20261108000002_test_result_status_cancelled extends Migration {

    override up(): void {
        this.addSql('ALTER TYPE main."testResultStatus" ADD VALUE IF NOT EXISTS \'CANCELLED\';')
    }

}
