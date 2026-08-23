import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicWafer } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, AgLinkCellFactory, EpicAgGrid, EpicAgGridFilter } from 'epic-ui/common/ag-grid'


export namespace EpicWafersGrid {

    export enum ColId {
        id = 'id',
        serialNumber = 'serialNumber',
        batchNumber = 'batchNumber',
        generalLocation = 'generalLocation',
        thinningDate = 'thinningDate',
        dicingDate = 'dicingDate',
        productionDate = 'productionDate',
        waferTypeId = 'waferTypeId',
        actions = 'actions',
    }

    export type RowEntity = EpicWafer

    export enum CellEventEvent {
        Edit = 'Edit',
        Clone = 'Clone',
        Delete = 'Delete',
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
                ...AgLinkCellFactory.createCellSchema<RowEntity, string>({
                    config: ({ rowData }) => ({
                        routerLink: ['../details', rowData.id],
                        tooltip: 'Details',
                    }),
                }),
                field: ColId.serialNumber,
                headerName: 'Serial No.',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.waferTypeId,
                headerName: 'Wafer Type',
            },
            {
                ...EpicAgGridFilter.getCommonNumberFilter(),
                field: ColId.batchNumber,
                headerName: 'Batch #',
                flex: 1,
                minWidth: 100,
            },
            {
                field: ColId.generalLocation,
                headerName: 'Location',
            },
            {
                ...EpicAgGridFilter.getCommonDateFilter(),
                field: ColId.productionDate,
                headerName: 'Production Date',
                flex: 1,
                minWidth: 120,
            },
            {
                ...EpicAgGridFilter.getCommonDateFilter(),
                field: ColId.thinningDate,
                headerName: 'Thinning Date',
                flex: 1,
                minWidth: 120,
            },
            {
                ...EpicAgGridFilter.getCommonDateFilter(),
                field: ColId.dicingDate,
                headerName: 'Dicing Date',
                flex: 1,
                minWidth: 120,
            },
            {
                colId: ColId.actions,
                ...AgIconActionsCell.getCellSchema<RowEntity>({
                    actions: ({ rowData }) => [
                        {
                            icon: 'epic-eye-open',
                            routerLink: ['../details', rowData.id],
                            tooltip: 'Details',
                        },
                        AgIconActionsCell.getMoreAction([
                            {
                                icon: 'epic-pencil',
                                title: 'Edit',
                                onClick: () => ({
                                    eventName: CellEventEvent.Edit,
                                }),
                            },{
                                icon: 'epic-copy',
                                title: 'Clone',
                                onClick: () => ({
                                    eventName: CellEventEvent.Clone,
                                }),
                            },
                            // {
                            //     icon: 'epic-delete',
                            //     title: 'Delete',
                            //     onClick: () => ({
                            //         eventName: CellEventEvent.Delete,
                            //     }),
                            // },
                        ]),
                    ],
                }),
                width: AgIconActionsCell.getCellWidth(2),
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
