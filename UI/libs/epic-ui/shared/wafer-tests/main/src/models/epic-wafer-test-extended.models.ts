import { EpicAsicTestType, EpicWafer, EpicWaferTest, EpicWpMachine } from 'epic-ui/api'


export type EpicWaferTestExtended =
    & EpicWaferTest
    &
    {
        wpMachine: EpicWpMachine | null
        wafer: EpicWafer | null
        asicTestType: EpicAsicTestType | null
    }
