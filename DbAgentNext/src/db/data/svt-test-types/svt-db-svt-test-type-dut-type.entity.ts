import { DeferMode, PrimaryKeyProp, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'

import { SvtDbSvtTestTypeEntity } from './svt-db-svt-test-type.entity'


/**
 * `main."SvtTestTypeDUTTypeList"`: which DUT types (`dutType` enum: ASIC family types and block types) a
 * test type applies to, one row each; the pair is the primary key. Read into `dutTypes` on the wire.
 */
@Entity({ tableName: 'SvtTestTypeDUTTypeList' })
export class SvtDbSvtTestTypeDutTypeEntity {

    @Enum({ primary: true, nativeEnumName: 'dutType', items: SVT_DB_ENUM_VALUES.dutType })
    dutType!: string

    @ManyToOne({
        entity: () => SvtDbSvtTestTypeEntity,
        primary: true,
        fieldName: 'testTypeId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    testType!: Ref<SvtDbSvtTestTypeEntity>;

    [PrimaryKeyProp]?: ['dutType', 'testType']

}
