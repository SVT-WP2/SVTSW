import { DeferMode, PrimaryKeyProp, Ref } from '@mikro-orm/core'
import { Entity, Enum, ManyToOne } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'

import { SvtDbWpProbeCardEntity } from './svt-db-wp-probe-card.entity'


/**
 * `main."ProbeCardFamilyType"`: which ASIC family types a probe card can probe, one row each; the pair is
 * the primary key. Read into the `asicFamilyTypes` of a probe card on the wire (R-3); no write path exists
 * in the contract yet.
 */
@Entity({ tableName: 'ProbeCardFamilyType' })
export class SvtDbWpProbeCardFamilyTypeEntity {

    @ManyToOne({
        entity: () => SvtDbWpProbeCardEntity,
        primary: true,
        fieldName: 'probeCardId',
        ref: true,
        deferMode: DeferMode.INITIALLY_IMMEDIATE,
        updateRule: 'no action',
        deleteRule: 'no action',
    })
    probeCard!: Ref<SvtDbWpProbeCardEntity>

    @Enum({ primary: true, nativeEnumName: 'asicFamilyType', items: SVT_DB_ENUM_VALUES.asicFamilyType })
    asicFamilyType!: string;

    [PrimaryKeyProp]?: ['probeCard', 'asicFamilyType']

}
