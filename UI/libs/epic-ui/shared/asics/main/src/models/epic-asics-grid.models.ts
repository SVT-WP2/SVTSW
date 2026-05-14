import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicAsic } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'


export namespace EpicAsicsGrid {

    export enum ColId {
        id = 'id',
        serialNumber = 'serialNumber',
        waferSerialNumber = 'waferSerialNumber',
        quality = 'quality',
        waferId = 'waferId',
        familyType = 'familyType',
        waferMapPosition = 'waferMapPosition',
        actions = 'actions',
    }

    export type RowEntity = EpicAsic

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
                field: ColId.serialNumber,
                headerName: 'Serial No.',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.waferId,
                headerName: 'Wafer ID',
                flex: 1,
                minWidth: 100,
            },
            {
                field: ColId.familyType,
                headerName: 'Family Type',
                flex: 1,
                minWidth: 100,
            },
            {
                field: ColId.waferMapPosition,
                headerName: 'Global Position on Wafer',
            },
            {
                field: ColId.quality,
                headerName: 'Quality',
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
                                icon: 'epic-copy',
                                title: 'Clone',
                                onClick: () => ({
                                    eventName: CellEventEvent.Clone,
                                }),
                            },
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
            getRowId: (params) => {
                return params.data.id.toString()
            },
        }
    }

}
