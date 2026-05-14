import { EpicLocationHistoryGrid } from '../../components'


export namespace EpicLocationHistoryDialog {

    export type Data = {
        dialogTitle: string
        historyRecords?: EpicLocationHistoryGrid.RowEntity[]
    }

}
