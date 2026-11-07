import { EpicWafer, EpicWpMachine } from 'epic-api-types'
import { EpicAsicTestType, EpicWaferTest } from 'epic-ui/api'


export type EpicWaferTestExtended =
    & EpicWaferTest
    &
    {
        wpMachine: EpicWpMachine | null
        wafer: EpicWafer | null
        asicTestType: EpicAsicTestType | null
    }
