import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'
import { SvtDbWaferEntity } from '../wafers'

import { SvtDbWpProbeCardEntity } from './svt-db-wp-probe-card.entity'


/**
 * `main."WaferProbeMachine"`: a wafer prober, with the wafer currently loaded and the probe card currently
 * installed (both nullable, each with its orientation). The histories are `WaferLoadedInMachine` and
 * `ProbeCardInstalledInMachine`. `generalLocation` has no history here and is a plain updatable column.
 */
@Entity({ tableName: 'WaferProbeMachine' })
export class SvtDbWpMachineEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @Property({ type: 'string', length: 50, unique: true })
    serialNumber!: string

    @Property({ type: 'string', length: 50, unique: true })
    name!: string

    @Property({ type: 'string', length: 200 })
    hostName!: string

    @Enum({ nativeEnumName: 'wpConnectionType', items: SVT_DB_ENUM_VALUES.wpConnectionType })
    connectionType!: string

    @Property({ type: 'integer' })
    connectionPort!: number

    @Enum({ nativeEnumName: 'wpGeneralLocation', items: SVT_DB_ENUM_VALUES.wpGeneralLocation })
    generalLocation!: string

    @Enum({ nativeEnumName: 'wpSwType', items: SVT_DB_ENUM_VALUES.wpSwType })
    software!: string

    @Property({ type: 'string', length: 50 })
    swVersion!: string

    @Enum({ nativeEnumName: 'wpVendor', items: SVT_DB_ENUM_VALUES.wpVendor })
    vendor!: string

    @ManyToOne({
        entity: () => SvtDbWaferEntity,
        fieldName: 'loadedWaferId',
        ref: true,
        nullable: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    loadedWafer!: Ref<SvtDbWaferEntity> | null

    @Enum({ nativeEnumName: 'waferMapOrientation', items: SVT_DB_ENUM_VALUES.waferMapOrientation, nullable: true })
    loadedWaferOrientation!: string | null

    @ManyToOne({
        entity: () => SvtDbWpProbeCardEntity,
        fieldName: 'installedProbeCardId',
        ref: true,
        nullable: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    installedProbeCard!: Ref<SvtDbWpProbeCardEntity> | null

    @Enum({ nativeEnumName: 'waferMapOrientation', items: SVT_DB_ENUM_VALUES.waferMapOrientation, nullable: true })
    installedProbeCardOrientation!: string | null;

    [OptionalProps]?: 'id' | 'loadedWafer' | 'loadedWaferOrientation' | 'installedProbeCard' | 'installedProbeCardOrientation'

}
