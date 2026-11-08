import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'
import { SvtDbWaferEntity } from '../wafers'

import { SvtDbWpMachineEntity } from './svt-db-wp-machine.entity'


/**
 * `main."WaferLoadedInMachine"`: one row per wafer loaded into (`status` `Loaded`) or removed from
 * (`Unloaded`) a prober, append-only. `id` is the surrogate key migration 1 added; `date` defaults to the day
 * of the insert; `username` is never written today.
 */
@Entity({ tableName: 'WaferLoadedInMachine' })
export class SvtDbWpWaferLoadedInMachineEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @ManyToOne({
        entity: () => SvtDbWpMachineEntity,
        fieldName: 'machineId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    machine!: Ref<SvtDbWpMachineEntity>

    @ManyToOne({
        entity: () => SvtDbWaferEntity,
        fieldName: 'waferId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    wafer!: Ref<SvtDbWaferEntity>

    @Enum({ nativeEnumName: 'waferMapOrientation', items: SVT_DB_ENUM_VALUES.waferMapOrientation, nullable: true })
    orientation!: string | null

    @Property({ type: 'date', nullable: true, defaultRaw: 'CURRENT_DATE' })
    date!: string | null

    @Property({ type: 'string', length: 50, nullable: true })
    username!: string | null

    @Enum({ nativeEnumName: 'waferInMachineStatus', items: SVT_DB_ENUM_VALUES.waferInMachineStatus, nullable: true })
    status!: string | null;

    [OptionalProps]?: 'id' | 'orientation' | 'date' | 'username' | 'status'

}
