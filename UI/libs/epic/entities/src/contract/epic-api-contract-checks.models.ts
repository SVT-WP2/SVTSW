import type {
    EpicApiPager,
    EpicAsic,
    EpicAsicsListQuery,
    EpicChipBlocksListQuery,
    EpicChipsListQuery,
    EpicEnumsCollectionQuery,
    EpicEquipmentListQuery,
    EpicEquipmentTypesListQuery,
    EpicSvtTestsListQuery,
    EpicSvtTestTemplatesListQuery,
    EpicSvtTestTypeConfigsListQuery,
    EpicSvtTestTypesListQuery,
    EpicWaferUpdateRequest,
} from 'epic-api-types'

import type { EpicAsicDto, EpicAsicsGetAllParamsDto } from '../asics'
import type { EpicChipBlocksGetAllParamsDto } from '../chip-blocks'
import type { EpicChipsGetAllParamsDto } from '../chips'
import type { EpicEnumsCollectionQueryFilterDto } from '../enums'
import type { EpicEquipmentGetAllParamsDto } from '../equipment'
import type { EpicEquipmentTypesGetAllParamsDto } from '../equipment-types'
import type {
    EpicSvtTestsGetAllParamsDto,
    EpicSvtTestTemplatesGetAllParamsDto,
    EpicSvtTestTypeConfigsGetAllParamsDto,
    EpicSvtTestTypesGetAllParamsDto,
} from '../svt-tests'
import type { EpicWaferUpdateRequestDto } from '../wafers'


type EpicKeysOnlyIn<TA, TB> = Exclude<keyof TA, keyof TB>

/**
 * `true` when `TDto` and `TContract` declare exactly the same members, otherwise the members that differ — so the
 * compile error below names them.
 */
export type EpicSameKeys<TDto, TContract> = [EpicKeysOnlyIn<TDto, TContract>, EpicKeysOnlyIn<TContract, TDto>] extends [never, never]
    ? true
    : { onlyInDto: EpicKeysOnlyIn<TDto, TContract>; onlyInContract: EpicKeysOnlyIn<TContract, TDto> }

type EpicAllTrue<T extends true[]> = T

/**
 * Compile-time guard for the DTOs whose `epic-api-types` type has optional members — the one case `implements`
 * cannot see.
 *
 * When every member of a type is required, `class XDto implements X` already fails on a missing or renamed member.
 * When members are optional (every `*ListQuery`), a class sharing a single member satisfies it, so a renamed or
 * added filter compiles and is then dropped by the global `ValidationPipe` (`whitelist: true`) — the way the ASIC
 * list once sent `familyTypes` / `quality` to a DTO expecting `asicFamilyTypes` / `asicQuality`.
 *
 * Add a pair whenever a contract type gains an optional member; list DTOs that take paging are compared against
 * `<X>ListQuery & EpicApiPager`. A failing entry reads `{ onlyInDto: '…'; onlyInContract: '…' }`.
 */
export type EpicApiContractChecks = EpicAllTrue<[
    EpicSameKeys<EpicAsicDto, EpicAsic>,
    EpicSameKeys<EpicAsicsGetAllParamsDto, EpicAsicsListQuery & EpicApiPager>,
    EpicSameKeys<EpicChipBlocksGetAllParamsDto, EpicChipBlocksListQuery & EpicApiPager>,
    EpicSameKeys<EpicChipsGetAllParamsDto, EpicChipsListQuery & EpicApiPager>,
    EpicSameKeys<EpicEnumsCollectionQueryFilterDto, EpicEnumsCollectionQuery>,
    EpicSameKeys<EpicEquipmentGetAllParamsDto, EpicEquipmentListQuery>,
    EpicSameKeys<EpicEquipmentTypesGetAllParamsDto, EpicEquipmentTypesListQuery>,
    EpicSameKeys<EpicSvtTestsGetAllParamsDto, EpicSvtTestsListQuery & EpicApiPager>,
    EpicSameKeys<EpicSvtTestTemplatesGetAllParamsDto, EpicSvtTestTemplatesListQuery>,
    EpicSameKeys<EpicSvtTestTypeConfigsGetAllParamsDto, EpicSvtTestTypeConfigsListQuery>,
    EpicSameKeys<EpicSvtTestTypesGetAllParamsDto, EpicSvtTestTypesListQuery>,
    EpicSameKeys<EpicWaferUpdateRequestDto, EpicWaferUpdateRequest>,
]>
