import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'
import { SvtDbWaferTypeEntity } from '../wafer-types'

import { SvtDbWpMachineEntity } from './svt-db-wp-machine.entity'


/**
 * `main."WaferProbeProject"`: a prober project (machine + wafer type + alignment), with the local-to-global
 * die map as `json`. The contract sends and receives `local2GlobalMap` as a JSON **string** (R-7); the
 * database column is nullable, the contract makes every field required.
 */
@Entity({ tableName: 'WaferProbeProject' })
export class SvtDbWpProjectEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @ManyToOne({
        entity: () => SvtDbWpMachineEntity,
        fieldName: 'wpMachineId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    wpMachine!: Ref<SvtDbWpMachineEntity>

    @ManyToOne({
        entity: () => SvtDbWaferTypeEntity,
        fieldName: 'waferTypeId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    waferType!: Ref<SvtDbWaferTypeEntity>

    @Enum({ nativeEnumName: 'asicFamilyType', items: SVT_DB_ENUM_VALUES.asicFamilyType, nullable: true })
    asicFamilyType!: string | null

    @Enum({ nativeEnumName: 'waferMapOrientation', items: SVT_DB_ENUM_VALUES.waferMapOrientation, nullable: true })
    orientation!: string | null

    @Property({ type: 'string', length: 100, unique: true })
    name!: string

    @Property({ type: 'string', length: 100, nullable: true })
    alignmentDie!: string | null

    @Property({ type: 'string', length: 100, nullable: true })
    homeDie!: string | null

    @Property({ type: 'json', columnType: 'json', nullable: true })
    local2GlobalMap!: unknown;

    [OptionalProps]?: 'id' | 'asicFamilyType' | 'orientation' | 'alignmentDie' | 'homeDie' | 'local2GlobalMap'

}
