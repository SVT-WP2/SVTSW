import { EpicSvtDutEntityName } from '../enums'


/**
 * Body of `POST /api/svt-tests`.
 */
export type EpicSvtTestCreateRequest = {
    dutEntityName: EpicSvtDutEntityName
    dutId: number
    testTypeConfigId: number
    testSetupConfigId: number
}
