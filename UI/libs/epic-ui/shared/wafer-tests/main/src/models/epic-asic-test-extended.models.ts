import { EpicAsic } from 'epic-api-types'
import { EpicAsicTest } from 'epic-ui/api'


export type EpicAsicTestExtended =
    & EpicAsicTest
    &
    {
        asic?: EpicAsic | null
    }
