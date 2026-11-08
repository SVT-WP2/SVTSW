import { OptionalProps } from '@mikro-orm/core'
import { Entity, Enum, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'


/**
 * `main."ProbeCard"`: a wafer-prober probe card. Reference data without a write message in the contract
 * (`CreateProbeCard` exists in the C++ code only); the ASIC family types it serves are `ProbeCardFamilyType`.
 */
@Entity({ tableName: 'ProbeCard' })
export class SvtDbWpProbeCardEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @Property({ type: 'string', length: 50, unique: true })
    serialNumber!: string

    @Enum({ nativeEnumName: 'pcVendor', items: SVT_DB_ENUM_VALUES.pcVendor })
    vendor!: string

    @Enum({ nativeEnumName: 'pcName', items: SVT_DB_ENUM_VALUES.pcName, unique: true })
    name!: string

    @Enum({ nativeEnumName: 'pcModel', items: SVT_DB_ENUM_VALUES.pcModel })
    model!: string

    @Property({ type: 'integer' })
    version!: number

    @Property({ type: 'date' })
    arriveDate!: string

    @Enum({ nativeEnumName: 'pcLocation', items: SVT_DB_ENUM_VALUES.pcLocation })
    location!: string

    @Enum({ nativeEnumName: 'pcType', items: SVT_DB_ENUM_VALUES.pcType })
    type!: string

    @Property({ type: 'integer' })
    vendorCleaningInterval!: number;

    [OptionalProps]?: 'id'

}
