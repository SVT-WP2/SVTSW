import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicWpMachine } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'


export namespace EpicWpProbeCardsGrid {

    export enum ColId {
        id = 'id',
        name = 'name',
        serialNumber = 'serialNumber',
        model = 'model',
        arriveDate = 'arriveDate',
        location = 'location',
        type = 'type',
        vendor = 'vendor',
        vendorCleaningInterval = 'vendorCleaningInterval',
        actions = 'actions',
    }

    export type RowEntity = EpicWpMachine

    export enum CellEventEvent {
        Details = 'Details',
        Edit = 'Edit',
        Clone = 'Clone',
        // Delete = 'Delete',
    }

    export function getColDefs(): ColDef[] {
        return [
            {
                field: ColId.id,
                headerName: 'ID',
                flex: 1,
                minWidth: 80,
            },
            {
                field: ColId.name,
                headerName: 'Name',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.serialNumber,
                headerName: 'Serial Number',
                flex: 1,
                minWidth: 100,
            },
            {
                field: ColId.model,
                headerName: 'Model',
            },
            {
                field: ColId.arriveDate,
                headerName: 'Arrive On',
                minWidth: 120,
            },
            {
                field: ColId.location,
                headerName: 'Location',
            },
            {
                field: ColId.type,
                headerName: 'Type',
                minWidth: 120,
            },
            {
                field: ColId.vendor,
                headerName: 'Vendor',
                minWidth: 120,
            },
            {
                field: ColId.vendorCleaningInterval,
                headerName: 'Cleaning Interval',
                minWidth: 120,
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
                        // }, {
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
                        //     {
                        //         icon: 'epic-pencil',
                        //         title: 'Edit',
                        //         onClick: () => ({
                        //             eventName: CellEventEvent.Edit,
                        //         }),
                        //     }, {
                        //         icon: 'epic-copy',
                        //         title: 'Clone',
                        //         onClick: () => ({
                        //             eventName: CellEventEvent.Clone,
                        //         }),
                        //     },
                        //     // {
                        //     //     icon: 'epic-delete',
                        //     //     title: 'Delete',
                        //     //     onClick: () => ({
                        //     //         eventName: CellEventEvent.Delete,
                        //     //     }),
                        //     // },
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
