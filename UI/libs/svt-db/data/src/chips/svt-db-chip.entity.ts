import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SvtDbAsicEntity } from '../asics'
import { SVT_DB_ENUM_VALUES } from '../enums'


/**
 * `main."Chip"`: a diced ASIC (`asicId`) with its current `generalLocation`. The history is `ChipLocation`,
 * the blocks `ChipBlock`; the `familyType` on the wire is the ASIC's (the C++ agent's LEFT JOIN column).
 */
@Entity({ tableName: 'Chip' })
export class SvtDbChipEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @ManyToOne({
        entity: () => SvtDbAsicEntity,
        fieldName: 'asicId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    asic!: Ref<SvtDbAsicEntity>

    @Property({ type: 'string', length: 50, unique: true })
    serialNumber!: string

    @Enum({ nativeEnumName: 'wpGeneralLocation', items: SVT_DB_ENUM_VALUES.wpGeneralLocation })
    generalLocation!: string;

    [OptionalProps]?: 'id'

}
