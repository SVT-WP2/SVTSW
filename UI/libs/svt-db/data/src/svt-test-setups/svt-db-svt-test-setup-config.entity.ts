import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SvtDbJsonTextType } from '../common'

import { SvtDbSvtTestSetupEntity } from './svt-db-svt-test-setup.entity'


/**
 * `main."SvtTestSetupConfig"`: a configuration file of a test setup. `configBody` is a `json` column kept as
 * text (`SvtDbJsonTextType`) and lazy: lists never load it, `GetSvtTestSetupConfigBody` populates it.
 * `createdAt` is stamped by the database.
 */
@Entity({ tableName: 'SvtTestSetupConfig' })
export class SvtDbSvtTestSetupConfigEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @ManyToOne({
        entity: () => SvtDbSvtTestSetupEntity,
        fieldName: 'setupId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    setup!: Ref<SvtDbSvtTestSetupEntity>

    @Property({ type: 'string', length: 100, unique: true })
    name!: string

    @Property({ type: 'text', nullable: true })
    note!: string | null

    @Property({ type: SvtDbJsonTextType, columnType: 'json', lazy: true })
    configBody!: string

    @Property({ type: 'date', nullable: true, defaultRaw: 'CURRENT_DATE' })
    createdAt!: string | null;

    [OptionalProps]?: 'id' | 'note' | 'createdAt'

}
