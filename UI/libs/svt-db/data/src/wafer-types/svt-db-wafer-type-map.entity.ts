import { DeferMode } from '@mikro-orm/core'
import { Entity, OneToOne, Property } from '@mikro-orm/decorators/legacy'

import { SvtDbWaferTypeEntity } from './svt-db-wafer-type.entity'


/**
 * `main."WaferTypeMap"`: the wafer map JSON of a wafer type. Its primary key is the wafer type's id
 * (`"waferTypeId"`), so a wafer type has at most one map.
 */
@Entity({ tableName: 'WaferTypeMap' })
export class SvtDbWaferTypeMapEntity {

    @OneToOne({
        entity: () => SvtDbWaferTypeEntity,
        primary: true,
        fieldName: 'waferTypeId',
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    waferType!: SvtDbWaferTypeEntity

    /** Parsed JSON (`json`, not `jsonb`, as in the database); it is a string on the Kafka wire. */
    @Property({ type: 'json', columnType: 'json' })
    waferMap!: unknown

}
