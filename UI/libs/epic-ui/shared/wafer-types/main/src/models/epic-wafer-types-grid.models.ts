import { ColDef, GridOptions } from 'ag-grid-community'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'
import { EpicWaferType } from 'svt-ts-types'


export namespace EpicWaferTypesGrid {

    export enum ColId {
        id = 'id',
        name = 'name',
        engineeringRun = 'engineeringRun',
        foundry = 'foundry',
        technology = 'technology',
        actions = 'actions',
    }

    export type RowEntity = EpicWaferType

    export enum CellEventEvent {
        Details = 'Details',
        Clone = 'Clone',
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
                field: ColId.engineeringRun,
                headerName: 'Eng. Run',
                flex: 1,
                minWidth: 100,
            },
            {
                field: ColId.foundry,
                headerName: 'Foundry',
            },
            {
                field: ColId.technology,
                headerName: 'Technology',

            },
            {
                colId: ColId.actions,
                ...AgIconActionsCell.getCellSchema<RowEntity>({
                    actions: ({ rowData }) => [
                        {
                            icon: 'epic-eye-open',
                            tooltip: 'Details',
                            onClick: () => ({
                                eventName: CellEventEvent.Details,
                            }),
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
            rowSelection: undefined,
        }
    }

}
