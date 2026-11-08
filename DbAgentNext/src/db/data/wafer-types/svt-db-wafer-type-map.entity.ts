import { DeferMode, PrimaryKeyProp } from '@mikro-orm/core'
import { Entity, OneToOne, Property } from '@mikro-orm/decorators/legacy'

import { SvtDbJsonTextType } from '../common'

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

    /**
     * The stored text of the `json` column (not `jsonb`, as in the database), returned byte for byte; parse it
     * for the domain logic (`JSON.parse`, the ASIC generation).
     */
    @Property({ type: SvtDbJsonTextType, columnType: 'json' })
    waferMap!: string;

    [PrimaryKeyProp]?: 'waferType'

}
