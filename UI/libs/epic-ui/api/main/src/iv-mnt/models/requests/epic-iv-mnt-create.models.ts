import { EpicSourceMeterConfig } from '../../../instruments'
import { EpicIvMntSettings } from '../epic-iv-mnt-settings.models'


export type EpicIvMntCreateRequestPayload = {
    name: string
    labels?: string[]
    settings: EpicIvMntSettings
    sourceMeterConfig: EpicSourceMeterConfig
}
