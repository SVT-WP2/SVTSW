import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'

import { SvtDbEquipmentEntity } from './svt-db-equipment.entity'


/**
 * `main."EquipmentLocation"`: one row per location change of a piece of equipment (append-only history),
 * the equipment counterpart of `WaferLocation`. `id` is the surrogate key migration 1 added; `date`
 * defaults to the day of the insert.
 */
@Entity({ tableName: 'EquipmentLocation' })
export class SvtDbEquipmentLocationEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @ManyToOne({
        entity: () => SvtDbEquipmentEntity,
        fieldName: 'equipmentId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    equipment!: Ref<SvtDbEquipmentEntity>

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
