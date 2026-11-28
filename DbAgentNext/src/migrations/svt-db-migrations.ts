import { MigrationObject } from '@mikro-orm/core'

import { Migration20261108000000_baseline_prod } from './Migration20261108000000_baseline_prod'
import { Migration20261108000001_dev_layout_and_surrogate_ids } from './Migration20261108000001_dev_layout_and_surrogate_ids'
import { Migration20261108000002_test_result_status_cancelled } from './Migration20261108000002_test_result_status_cancelled'
import { Migration20261108000003_june_layout_leftovers } from './Migration20261108000003_june_layout_leftovers'
import { Migration20261112000004_config_body_text } from './Migration20261112000004_config_body_text'
import { Migration20261126000005_users } from './Migration20261126000005_users'


/**
 * Every migration of the database, in the order of the timestamps. The application applies the pending ones at
 * start, and it ships as one bundle: the classes are listed, not discovered from files. Add each new migration
 * here (`svt-db-migrations.spec.ts` fails when one is missing). The name is the file name, which is the name the
 * MikroORM CLI records in `mikro_orm_migrations`.
 */
export const SVT_DB_MIGRATIONS: MigrationObject[] = [
    { name: 'Migration20261108000000_baseline_prod', class: Migration20261108000000_baseline_prod },
    { name: 'Migration20261108000001_dev_layout_and_surrogate_ids', class: Migration20261108000001_dev_layout_and_surrogate_ids },
    { name: 'Migration20261108000002_test_result_status_cancelled', class: Migration20261108000002_test_result_status_cancelled },
    { name: 'Migration20261108000003_june_layout_leftovers', class: Migration20261108000003_june_layout_leftovers },
    { name: 'Migration20261112000004_config_body_text', class: Migration20261112000004_config_body_text },
    { name: 'Migration20261126000005_users', class: Migration20261126000005_users },
]
