import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'
import { SvtDbSvtTestSetupConfigEntity } from '../svt-test-setups'
import { SvtDbSvtTestTypeConfigEntity } from '../svt-test-types'


/**
 * `main."SvtTestList"`: one SVT test run (a test type configuration on a test setup configuration). The device
 * under test is in `SvtTestListToEntityName` / `SvtTestListToEntityId` (polymorphic: ASIC, chip or chip block,
 * no foreign key). Timestamps are `timestamp without time zone`, read and written as UTC; `createdAt` is
 * stamped by the database. `testResultStatus` is the database enum (`SUCCESS`, `PARTIAL_SUCCESS`, …), set by
 * `UpdateSvtTestFinish`.
 */
@Entity({ tableName: 'SvtTestList' })
export class SvtDbSvtTestEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @ManyToOne({
        entity: () => SvtDbSvtTestTypeConfigEntity,
        fieldName: 'testTypeConfigId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    testTypeConfig!: Ref<SvtDbSvtTestTypeConfigEntity>

    @ManyToOne({
        entity: () => SvtDbSvtTestSetupConfigEntity,
        fieldName: 'testSetupConfigId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    testSetupConfig!: Ref<SvtDbSvtTestSetupConfigEntity>

    @Property({ type: 'datetime', columnType: 'timestamp', nullable: true, defaultRaw: 'CURRENT_TIMESTAMP' })
    createdAt!: Date | null

    @Property({ type: 'datetime', columnType: 'timestamp', nullable: true })
    startedAt!: Date | null

    @Property({ type: 'datetime', columnType: 'timestamp', nullable: true })
    finishedAt!: Date | null

    @Property({ type: 'text', nullable: true })
    pathToResult!: string | null

    @Enum({ nativeEnumName: 'testResultStatus', items: SVT_DB_ENUM_VALUES.testResultStatus, nullable: true })
    testResultStatus!: string | null;

    [OptionalProps]?: 'id' | 'createdAt' | 'startedAt' | 'finishedAt' | 'pathToResult' | 'testResultStatus'

}
