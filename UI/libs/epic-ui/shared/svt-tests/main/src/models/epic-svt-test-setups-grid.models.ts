import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicSvtTestSetup } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'


export namespace EpicSvtTestSetupsGrid {

    export enum ColId {
        id = 'id',
        name = 'name',
        generalLocation = 'generalLocation',
        actions = 'actions',
    }

    export type RowEntity = EpicSvtTestSetup

    export enum CellEventEvent {
        Details = 'Details',
        // Edit = 'Edit',
        // Clone = 'Clone',
        // Delete = 'Delete',
    }

    export function getColDefs(): ColDef[] {
        return [
            {
                field: ColId.id,
                headerName: 'ID',
                minWidth: 80,
            },
            {
                field: ColId.name,
                headerName: 'Name',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.generalLocation,
                headerName: 'Location',
                flex: 1,
                minWidth: 200,
            },
            {
                colId: ColId.actions,
                ...AgIconActionsCell.getCellSchema<RowEntity>({
                    actions: ({ rowData }) => [
                        // {
                        //     icon: 'epic-pencil',
                        //     tooltip: 'Edit',
                        //     onClick: () => ({
                        //         eventName: CellEventEvent.Edit,
                        //     }),
                        // },
                        // {
                        //     icon: 'epic-copy',
                        //     tooltip: 'Clone',
                        //     onClick: () => ({
                        //         eventName: CellEventEvent.Clone,
                        //     }),
                        // },
                        {
                            icon: 'epic-eye-open',
                            tooltip: 'Details',
                            onClick: () => ({
                                eventName: CellEventEvent.Details,
                            }),
                        },
                        // AgIconActionsCell.getMoreAction([
                        // {
                        //     icon: 'epic-pencil',
                        //     title: 'Edit',
                        //     onClick: () => ({
                        //         eventName: CellEventEvent.Edit,
                        //     }),
                        // },
                        // {
                        //     icon: 'epic-copy',
                        //     title: 'Clone',
                        //     onClick: () => ({
                        //         eventName: CellEventEvent.Clone,
                        //     }),
                        // },
                        // {
                        //     icon: 'epic-delete',
                        //     title: 'Delete',
                        //     onClick: () => ({
                        //         eventName: CellEventEvent.Delete,
                        //     }),
                        // },
                        // ]),
                    ],
                }),
                width: AgIconActionsCell.getCellWidth(1),
                cellRenderer: AgIconActionsCellComponent,
            },
        ]
    }

    export function getGridOptions(): GridOptions<RowEntity> {
        return {
            ...EpicAgGrid.getDefaultGridOptions<RowEntity>(),
            rowSelection: undefined,
            getRowId: (params) => {
                return params.data.id.toString()
            },
        }
    }

}
