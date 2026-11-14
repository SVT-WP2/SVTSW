import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'

import { SvtDbChipEntity } from './svt-db-chip.entity'


/**
 * `main."ChipBlock"`: a functional block of a chip (`blockType` enum), with its own serial number. Written
 * with the chip from `AsicFamilyTypeBlockList` when the chip-blocks feature is on (`generateChipBlocks`).
 */
@Entity({ tableName: 'ChipBlock' })
export class SvtDbChipBlockEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @ManyToOne({
        entity: () => SvtDbChipEntity,
        fieldName: 'chipId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    chip!: Ref<SvtDbChipEntity>

    @Enum({ nativeEnumName: 'blockType', items: SVT_DB_ENUM_VALUES.blockType })
    blockType!: string

    @Property({ type: 'string', length: 50, unique: true })
    serialNumber!: string;

    [OptionalProps]?: 'id'

}
