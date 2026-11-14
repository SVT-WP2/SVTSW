import { DeferMode, PrimaryKeyProp, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'

import { SvtDbSvtTestEntity } from './svt-db-svt-test.entity'


/**
 * `main."SvtTestListToEntityName"`: which kind of device (`dutEntityName` enum: `Asic`, `Chip`, `ChipBlock`) a
 * test runs on; the pair is the primary key and a test has exactly one row (scalar relation in the C++).
 */
@Entity({ tableName: 'SvtTestListToEntityName' })
export class SvtDbSvtTestDutEntityNameEntity {

    @Enum({ primary: true, nativeEnumName: 'dutEntityName', items: SVT_DB_ENUM_VALUES.dutEntityName })
    dutEntityName!: string

    @ManyToOne({
        entity: () => SvtDbSvtTestEntity,
        primary: true,
        fieldName: 'testId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    test!: Ref<SvtDbSvtTestEntity>;

    [PrimaryKeyProp]?: ['dutEntityName', 'test']

}
