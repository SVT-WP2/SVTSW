import { EpicWsMessage } from '../../../common'
import { EpicMntStatus } from '../../../measurement'
import { EpicIvDataRecord } from '../epic-iv-data-record.models'


export namespace EpicIvMntWs {

    export enum EventName {
        StatusChanged = 'IvMnt.StatusChanged',
        NewData = 'IvMnt.NewData',
    }

    export type StatusChangedData = {
        status: EpicMntStatus
        measurementId: string
        errorMessage?: string
    }

    export type StatusChangedMessage = EpicWsMessage<StatusChangedData, EventName.StatusChanged>

    export type NewDataData = {
        dataRecords: EpicIvDataRecord[]
        measurementId: string
    }

    export type NewDataMessage = EpicWsMessage<NewDataData, EventName.NewData>


    export type Message =
        | StatusChangedMessage
        | NewDataMessage

}
