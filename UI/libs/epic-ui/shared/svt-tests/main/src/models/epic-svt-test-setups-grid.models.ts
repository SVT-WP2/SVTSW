import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicSvtTestSetup } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, AgLinkCellFactory, EpicAgGrid } from 'epic-ui/common/ag-grid'


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

    // a test setup is always opened on one of its configs — the default one
    export function getDetailsRouterLink(rowData: RowEntity): (string | number)[] {
        return ['../details', rowData.id, 'config', rowData.defaultConfigId]
    }

    export function getColDefs(): ColDef[] {
        return [
            {
                field: ColId.id,
                headerName: 'ID',
                minWidth: 80,
            },
            {
                ...AgLinkCellFactory.createCellSchema<RowEntity, string>({
                    config: ({ rowData }) => ({
                        routerLink: getDetailsRouterLink(rowData),
                        tooltip: 'Details',
                    }),
                }),
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
