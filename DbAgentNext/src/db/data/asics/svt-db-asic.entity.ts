import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'
import { SvtDbWaferEntity } from '../wafers'


/**
 * `main."Asic"`: one die of a wafer, generated from the wafer map when the wafer is created
 * (`DbAgent/docs/06-wafer-map.md` §4). `waferMapPosition` is `"<row>_<col>"`.
 */
@Entity({ tableName: 'Asic' })
export class SvtDbAsicEntity {

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

    @Property({ type: 'string', length: 50, unique: true })
    serialNumber!: string

    @Enum({ nativeEnumName: 'asicFamilyType', items: SVT_DB_ENUM_VALUES.asicFamilyType })
    familyType!: string

    @Property({ type: 'string', length: 50 })
    waferMapPosition!: string

    @Enum({ nativeEnumName: 'asicQuality', items: SVT_DB_ENUM_VALUES.asicQuality })
    quality!: string;

    [OptionalProps]?: 'id'

}
