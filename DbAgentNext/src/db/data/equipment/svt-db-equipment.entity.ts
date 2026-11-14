import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'

import { SvtDbEquipmentTypeEntity } from './svt-db-equipment-type.entity'


/**
 * `main."Equipment"`: a piece of lab equipment of an `EquipmentType`, with its current `generalLocation`
 * (history in `EquipmentLocation`) and a free-form `specification` (`json`, nullable; a JSON string on the
 * wire, R-7).
 */
@Entity({ tableName: 'Equipment' })
export class SvtDbEquipmentEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @Property({ type: 'string', length: 50, unique: true })
    name!: string

    @ManyToOne({
        entity: () => SvtDbEquipmentTypeEntity,
        fieldName: 'equipmentTypeId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    equipmentType!: Ref<SvtDbEquipmentTypeEntity>

    @Enum({ nativeEnumName: 'wpGeneralLocation', items: SVT_DB_ENUM_VALUES.wpGeneralLocation })
    generalLocation!: string

    @Property({ type: 'json', columnType: 'json', nullable: true })
    specification!: unknown;

    [OptionalProps]?: 'id' | 'specification'

}
