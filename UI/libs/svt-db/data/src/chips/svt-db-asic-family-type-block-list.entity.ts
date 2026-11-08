import { PrimaryKeyProp } from '@mikro-orm/core'
import { Entity, Enum } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'


/**
 * `main."AsicFamilyTypeBlockList"`: which block types a chip of a given ASIC family type consists of; one row
 * per (family type, block type), both enums, together the primary key. Reference data maintained by hand
 * (three `AncMPW2` rows on dev, none on prod at the time of writing).
 */
@Entity({ tableName: 'AsicFamilyTypeBlockList' })
export class SvtDbAsicFamilyTypeBlockListEntity {

    @Enum({ primary: true, nativeEnumName: 'asicFamilyType', items: SVT_DB_ENUM_VALUES.asicFamilyType })
    asicFamilyType!: string

    @Enum({ primary: true, nativeEnumName: 'blockType', items: SVT_DB_ENUM_VALUES.blockType })
    blockType!: string;

    [PrimaryKeyProp]?: ['asicFamilyType', 'blockType']

}
