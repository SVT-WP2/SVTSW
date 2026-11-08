import { EpicAsicTestType, EpicWaferTest } from 'epic-ui/api'
import { EpicWafer, EpicWpMachine } from 'svt-ts-types'


export type EpicWaferTestExtended =
    & EpicWaferTest
    &
    {
        wpMachine: EpicWpMachine | null
        wafer: EpicWafer | null
        asicTestType: EpicAsicTestType | null
    }
