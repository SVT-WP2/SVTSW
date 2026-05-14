import { EpicSourceMeterConfig } from '../../instruments'
import { EpicMeasurement } from '../../measurement'

import { EpicIvDataRecord } from './epic-iv-data-record.models'
import { EpicIvMntSettings } from './epic-iv-mnt-settings.models'


export type EpicIvMnt =
    & EpicMeasurement
    &
    {
        data: EpicIvDataRecord[]
        settings: EpicIvMntSettings
        sourceMeterConfig: EpicSourceMeterConfig
    }
