import { EpicDateString } from '../../common'


/**
 * Body of `PATCH /api/wafers/:waferId` — every member is optional, an omitted one is left untouched.
 */
export type EpicWaferUpdateRequest = {
    thinningDate?: EpicDateString | null
    dicingDate?: EpicDateString | null
    productionDate?: EpicDateString | null
}
