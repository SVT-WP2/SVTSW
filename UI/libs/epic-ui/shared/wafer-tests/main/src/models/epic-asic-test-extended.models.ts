import { EpicAsic, EpicAsicTest } from 'epic-ui/api'


export type EpicAsicTestExtended =
    & EpicAsicTest
    &
    {
        asic?: EpicAsic | null
    }
