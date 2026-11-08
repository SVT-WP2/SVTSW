import { DeferMode, OptionalProps, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'

import { SvtDbWpMachineEntity } from './svt-db-wp-machine.entity'
import { SvtDbWpProbeCardEntity } from './svt-db-wp-probe-card.entity'


/**
 * `main."ProbeCardInstalledInMachine"`: one row per probe card installed into a prober, append-only. There is
 * no status column and `probeCardId` is NOT NULL, so an uninstall cannot be recorded here until the schema
 * change of `docs/db-agent-clone/02-database-migration.md` §2 (D-13). `id` is the surrogate key of migration 1.
 */
@Entity({ tableName: 'ProbeCardInstalledInMachine' })
export class SvtDbWpProbeCardInstalledInMachineEntity {

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
        entity: () => SvtDbWpProbeCardEntity,
        fieldName: 'probeCardId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    probeCard!: Ref<SvtDbWpProbeCardEntity>

    @Enum({ nativeEnumName: 'waferMapOrientation', items: SVT_DB_ENUM_VALUES.waferMapOrientation, nullable: true })
    orientation!: string | null

    @Property({ type: 'date', nullable: true, defaultRaw: 'CURRENT_DATE' })
    date!: string | null

    @Property({ type: 'string', length: 50, nullable: true })
    username!: string | null;

    [OptionalProps]?: 'id' | 'orientation' | 'date' | 'username'

}
