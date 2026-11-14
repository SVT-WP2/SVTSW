import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SvtDbSvtTestEntity } from './svt-db-svt-test.entity'


/**
 * `main."SvtTestListToEntityId"`: the id of the device a test runs on, in the table named by the test's
 * `SvtTestListToEntityName` row (polymorphic, no foreign key). `id` is the surrogate key migration 1 added; a
 * test has exactly one row.
 */
@Entity({ tableName: 'SvtTestListToEntityId' })
export class SvtDbSvtTestDutIdEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @ManyToOne({
        entity: () => SvtDbSvtTestEntity,
        fieldName: 'testId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    test!: Ref<SvtDbSvtTestEntity>

    @Property({ type: 'integer' })
    dutId!: number;

    [OptionalProps]?: 'id'

}
