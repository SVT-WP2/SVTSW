import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'

import { SvtDbChipEntity } from './svt-db-chip.entity'


/**
 * `main."ChipLocation"`: one row per location change of a chip (append-only history), the chip's counterpart
 * of `WaferLocation`. `id` is the surrogate key migration 1 added; `date` defaults to the day of the insert.
 */
@Entity({ tableName: 'ChipLocation' })
export class SvtDbChipLocationEntity {

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
