import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'
import { SvtDbWaferTypeEntity } from '../wafer-types'


/**
 * `main."Wafer"`: a physical wafer of a wafer type. Its location history is `WaferLocation`; `generalLocation`
 * mirrors the most recently written history row. Dates are `date` columns, strings `YYYY-MM-DD` in code.
 */
@Entity({ tableName: 'Wafer' })
export class SvtDbWaferEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @ManyToOne({
        entity: () => SvtDbWaferTypeEntity,
        fieldName: 'waferTypeId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    waferType!: Ref<SvtDbWaferTypeEntity>

    @Property({ type: 'string', length: 50, unique: true })
    serialNumber!: string

    @Property({ type: 'integer' })
    batchNumber!: number

    @Property({ type: 'date', nullable: true })
    thinningDate!: string | null

    @Property({ type: 'date', nullable: true })
    dicingDate!: string | null

    @Property({ type: 'date', nullable: true })
    productionDate!: string | null

    @Enum({ nativeEnumName: 'wpGeneralLocation', items: SVT_DB_ENUM_VALUES.wpGeneralLocation, nullable: true })
    generalLocation!: string | null;

    [OptionalProps]?: 'id' | 'thinningDate' | 'dicingDate' | 'productionDate' | 'generalLocation'

}
