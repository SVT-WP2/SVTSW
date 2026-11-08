import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'

import { SvtDbJsonTextType } from '../common'

import { SvtDbSvtTestTypeEntity } from './svt-db-svt-test-type.entity'


/**
 * `main."SvtTestTypeConfig"`: a configuration file of a test type. `configBody` is a `json` column kept as
 * text (`SvtDbJsonTextType`) and lazy: lists never load it, `GetSvtTestTypeConfigBody` populates it. Unlike
 * setup configurations, the name is unique per test type (a `CREATE UNIQUE INDEX`, hence the explicit name).
 */
@Entity({ tableName: 'SvtTestTypeConfig' })
@Unique({ properties: ['testType', 'name'], name: 'SvtTestTypeConfig_testTypeId_name_idx' })
export class SvtDbSvtTestTypeConfigEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @ManyToOne({
        entity: () => SvtDbSvtTestTypeEntity,
        fieldName: 'testTypeId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    testType!: Ref<SvtDbSvtTestTypeEntity>

    @Property({ type: 'string', length: 100 })
    name!: string

    @Property({ type: 'text', nullable: true })
    note!: string | null

    @Property({ type: SvtDbJsonTextType, columnType: 'json', lazy: true })
    configBody!: string

    @Property({ type: 'date', nullable: true, defaultRaw: 'CURRENT_DATE' })
    createdAt!: string | null;

    [OptionalProps]?: 'id' | 'note' | 'createdAt'

}
