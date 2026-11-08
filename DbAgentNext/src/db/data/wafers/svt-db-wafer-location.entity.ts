import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'

import { SvtDbWaferEntity } from './svt-db-wafer.entity'


/**
 * `main."WaferLocation"`: one row per location change of a wafer (append-only history). `id` is the surrogate
 * key migration 1 added; the current location is the row with the highest id. `date` defaults to the day of
 * the insert in the database.
 */
@Entity({ tableName: 'WaferLocation' })
export class SvtDbWaferLocationEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @ManyToOne({
        entity: () => SvtDbWaferEntity,
        fieldName: 'waferId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    wafer!: Ref<SvtDbWaferEntity>

    @Enum({ nativeEnumName: 'wpGeneralLocation', items: SVT_DB_ENUM_VALUES.wpGeneralLocation })
    generalLocation!: string

    @Property({ type: 'date', nullable: true, defaultRaw: 'CURRENT_DATE' })
    date!: string | null

    @Property({ type: 'string', length: 50, nullable: true })
    username!: string | null

    @Property({ type: 'text', nullable: true })
    note!: string | null;

    [OptionalProps]?: 'id' | 'date' | 'username' | 'note'

}
