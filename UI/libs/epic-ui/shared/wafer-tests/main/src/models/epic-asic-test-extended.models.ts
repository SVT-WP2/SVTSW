import { EpicAsicTest } from 'epic-ui/api'
import { EpicAsic } from 'svt-ts-types'


export type EpicAsicTestExtended =
    & EpicAsicTest
    &
    {
        asic?: EpicAsic | null
    }
