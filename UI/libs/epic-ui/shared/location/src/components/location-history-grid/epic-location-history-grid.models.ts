import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicAgGrid, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import moment from 'moment'


export namespace EpicLocationHistoryGrid {

    export type RowEntity = {
        id: string
        generalLocation: string
        date: string
        note: string
        /** Free text that a client sent with the move. Rows from before the users may hold a name here. */
        username: string | null
        /** The name of the user who moved it; `null` for an older row or a move without a user. */
        userName: string | null
    }

    export enum ColId {
        generalLocation = 'generalLocation',
        date = 'date',
        updatedBy = 'updatedBy',
        note = 'note',
    }

    /** Who moved it: the name of its user, or for an older row the free text `username`. */
    export function getUpdatedBy(row: Pick<RowEntity, 'userName' | 'username'> | undefined): string | null {
        return row?.userName ?? row?.username ?? null
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
                colId: ColId.updatedBy,
                headerName: 'Updated By',
                flex: 1,
                valueGetter: ({ data }) => getUpdatedBy(data),
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
