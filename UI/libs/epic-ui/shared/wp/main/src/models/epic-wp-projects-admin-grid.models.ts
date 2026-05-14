import { ColDef, GridOptions, ValueGetterParams } from 'ag-grid-community'
import { EpicWpProject } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'


export namespace EpicWpProjectsAdminGrid {

    export enum ColId {
        id = 'id',
        wpMachineId = 'wpMachineId',
        waferTypeId = 'waferTypeId',
        name = 'name',
        asicFamilyType = 'asicFamilyType',
        orientation = 'orientation',
        alignmentDie = 'alignmentDie',
        homeDie = 'homeDie',
        actions = 'actions',
    }

    export type RowEntity = EpicWpProject

    export enum CellEventEvent {
        Details = 'Details',
        // Edit = 'Edit',
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
                field: ColId.wpMachineId,
                headerName: 'WP Machine',
                flex: 1,
                valueGetter: (params: ValueGetterParams<RowEntity>) => params.data?.wpMachine?.name ?? params.data?.wpMachineId,
            },
            {
                field: ColId.name,
                headerName: 'Name',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.waferTypeId,
                headerName: 'Wafer Type',
                flex: 1,
                valueGetter: (params: ValueGetterParams<RowEntity>) => params.data?.waferType?.name ?? params.data?.waferTypeId,
            },
            {
                field: ColId.asicFamilyType,
                headerName: 'ASIC Family Type',
                flex: 1,
                minWidth: 150,
            },
            {
                field: ColId.orientation,
                headerName: 'Wafer Orientation',
            },
            {
                field: ColId.alignmentDie,
                headerName: 'Alignment Die',
                width: 100,
            },
            {
                field: ColId.homeDie,
                headerName: 'Home Die',
                width: 100,
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
                        AgIconActionsCell.getMoreAction([
                            // {
                            //     icon: 'epic-pencil',
                            //     title: 'Edit',
                            //     onClick: () => ({
                            //         eventName: CellEventEvent.Edit,
                            //     }),
                            // },
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
