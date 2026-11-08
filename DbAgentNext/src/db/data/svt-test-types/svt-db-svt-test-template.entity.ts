import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'

import { SvtDbSvtTestTypeConfigEntity } from './svt-db-svt-test-type-config.entity'


/**
 * `main."SvtTestTemplate"`: "run this test type configuration on every DUT of this type". `testTypeId` on
 * the wire comes from the configuration (migration 1 made `testTypeConfigId` NOT NULL). `isEnabled` defaults
 * to true in the database; a DUT type + configuration pair is unique (a `CREATE UNIQUE INDEX`, hence the name).
 */
@Entity({ tableName: 'SvtTestTemplate' })
@Unique({ properties: ['dutType', 'testTypeConfig'], name: 'SvtTestTemplate_dutType_testTypeConfigId_idx' })
export class SvtDbSvtTestTemplateEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @Enum({ nativeEnumName: 'dutType', items: SVT_DB_ENUM_VALUES.dutType, nullable: true })
    dutType!: string | null

    @ManyToOne({
        entity: () => SvtDbSvtTestTypeConfigEntity,
        fieldName: 'testTypeConfigId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    testTypeConfig!: Ref<SvtDbSvtTestTypeConfigEntity>

    @Property({ type: 'boolean', nullable: true, default: true })
    isEnabled!: boolean | null;

    [OptionalProps]?: 'id' | 'dutType' | 'isEnabled'

}
