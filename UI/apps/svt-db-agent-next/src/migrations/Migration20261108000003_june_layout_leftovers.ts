import { Migration } from '@mikro-orm/migrations'


/**
 * Migration 3: the differences a database restored from the **June 2026** dump still has against the
 * production layout (`DbAgent/docs/03-database-schema.md` §5, S1, S8 and S9): `ProbeCard.arrivalDate` was
 * renamed to `arriveDate`, `pcModel` gained its seventh value and `pcName` its fourth. All guarded, so a
 * production- or dev-shaped database (which already has them) is untouched. Found on a developer machine
 * whose `svt_sw_db` came from that dump; migration 0 only adds what is missing and cannot rename.
 */
export class Migration20261108000003_june_layout_leftovers extends Migration {

    override up(): void {
        this.addSql(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'main' AND table_name = 'ProbeCard' AND column_name = 'arrivalDate'
                ) THEN
                    ALTER TABLE main."ProbeCard" RENAME COLUMN "arrivalDate" TO "arriveDate";
                END IF;
            END $$;
        `)
        this.addSql(
            'ALTER TYPE main."pcModel" ADD VALUE IF NOT EXISTS \'MOSAIX-LEC-TS3500-CABLEOUT-OTHERS-MLOO-EVS-P-VY540\''
            + ' AFTER \'NKF7-TS3500-CABLEOUT-MLO(EVS-P)\';',
        )
        this.addSql('ALTER TYPE main."pcName" ADD VALUE IF NOT EXISTS \'MOSAIX_LEC\' AFTER \'NKF7_MPI\';')
    }

}
