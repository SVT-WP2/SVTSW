import { DeferMode, PrimaryKeyProp, Ref } from '@mikro-orm/core'
import { Entity, ManyToOne, OneToOne } from '@mikro-orm/decorators/legacy'

import { SvtDbSvtTestSetupConfigEntity } from './svt-db-svt-test-setup-config.entity'
import { SvtDbSvtTestSetupEntity } from './svt-db-svt-test-setup.entity'


/**
 * `main."SvtTestSetupDefaultConfig"`: which configuration a test setup uses by default; the primary key is
 * the setup's id, so a setup has at most one row. A setup without a row has no default (`null` on the wire,
 * where the C++ failed the whole list: Q-R2).
 */
@Entity({ tableName: 'SvtTestSetupDefaultConfig' })
export class SvtDbSvtTestSetupDefaultConfigEntity {

    @OneToOne({
        entity: () => SvtDbSvtTestSetupEntity,
        primary: true,
        fieldName: 'setupId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    setup!: Ref<SvtDbSvtTestSetupEntity>

    @ManyToOne({
        entity: () => SvtDbSvtTestSetupConfigEntity,
        fieldName: 'defaultConfigId',
        ref: true,
        nullable: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    defaultConfig!: Ref<SvtDbSvtTestSetupConfigEntity> | null;

    [PrimaryKeyProp]?: 'setup'

}
