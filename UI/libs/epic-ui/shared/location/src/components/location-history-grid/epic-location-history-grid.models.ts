import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicAgGrid, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import moment from 'moment'


export namespace EpicLocationHistoryGrid {

    export type RowEntity = {
        id: string
        generalLocation: string
        date: string
        note: string
        username: string | null
    }

    export enum ColId {
        generalLocation = 'generalLocation',
        date = 'date',
        username = 'username',
        note = 'note',
    }

    export function getColDefs(): ColDef<RowEntity>[] {
        return [
            {
                field: ColId.generalLocation,
                headerName: 'Location',
                flex: 1,
                minWidth: 200,
            },
            {
                type: EpicAgGridCell.DefaultCellType.dateTimeColumn,
                field: ColId.date,
                filter: 'agDateColumnFilter',
                headerName: 'Changed At',
                flex: 1,
                minWidth: 200,
                valueFormatter: ({ value }) => moment(value).format('YYYY-MM-DD'),
                valueGetter: ({ data }) => data?.date ? moment(data?.date).startOf('day').toDate() : null,
                sort: 'desc',
            },
            {
                field: ColId.note,
                headerName: 'Note',
                flex: 1,
            },
            {
                field: ColId.username,
                headerName: 'Updated By',
                flex: 1,
            },
        ]
    }

    export function getGridOptions(): GridOptions<RowEntity> {
        return {
            ...EpicAgGrid.getDefaultGridOptions<RowEntity>(),
            rowSelection: undefined,
            getRowId: (params) => {
                return params.data.id
            },
            pagination: false,
            domLayout: 'autoHeight',
        }
    }

}
