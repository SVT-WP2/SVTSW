import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicWpMachine } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'


export namespace EpicWpMachinesGrid {

    export enum ColId {
        id = 'id',
        name = 'name',
        serialNumber = 'serialNumber',
        hostName = 'hostName',
        connectionType = 'connectionType',
        connectionPort = 'connectionPort',
        generalLocation = 'generalLocation',
        software = 'software',
        swVersion = 'swVersion',
        vendor = 'vendor',
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
                field: ColId.serialNumber,
                headerName: 'Serial No.',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.name,
                headerName: 'Name',
                flex: 1,
                minWidth: 200,
            },

            {
                field: ColId.hostName,
                headerName: 'Host Name',
                flex: 1,
                minWidth: 180,
            },
            {
                field: ColId.connectionPort,
                headerName: 'Connection Port',
                minWidth: 80,
            },
            {
                field: ColId.connectionType,
                headerName: 'Connection Type',
            },
            {
                field: ColId.generalLocation,
                headerName: 'Location',

            },
            {
                field: ColId.software,
                headerName: 'Software',
            },
            {
                field: ColId.swVersion,
                headerName: 'SW Version',
            },
            {
                field: ColId.vendor,
                headerName: 'Vendor',
            },
            {
                colId: ColId.actions,
                ...AgIconActionsCell.getCellSchema<RowEntity>({
                    actions: ({ rowData }) => [
                        // {
                        //     icon: 'epic-eye-open',
                        //     tooltip: 'Details',
                        //     onClick: () => ({
                        //         eventName: CellEventEvent.Details,
                        //     }),
                        // },
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
                        AgIconActionsCell.getMoreAction([
                            {
                                icon: 'epic-pencil',
                                title: 'Edit',
                                onClick: () => ({
                                    eventName: CellEventEvent.Edit,
                                }),
                            },
                            {
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
