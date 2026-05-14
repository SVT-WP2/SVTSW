import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicSvtTestTemplate, EpicSvtTestType, EpicSvtTestTypeConfig } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'


export namespace EpicSvtTestTemplateGrid {

    export enum ColId {
        id = 'id',
        dutType = 'dutType',
        testType = 'testType.name',
        testTypeConfig = 'testTypeConfig.name',
        isEnabled = 'isEnabled',
        actions = 'actions',
    }

    export type RowEntity =
        & EpicSvtTestTemplate
        &
        {
            testType: EpicSvtTestType
            testTypeConfig: EpicSvtTestTypeConfig
        }

    export enum CellEventEvent {
        Edit = 'Edit',
    }

    export function getColDefs(): ColDef<RowEntity>[] {
        return [
            {
                field: ColId.id,
                headerName: 'ID',
                flex: 1,
                minWidth: 80,
            },
            {
                field: ColId.dutType,
                headerName: 'DUT Type',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.testType,
                headerName: 'Test Type',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.testTypeConfig,
                headerName: 'Test Type Config',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.isEnabled,
                headerName: 'Enabled',
                flex: 1,
                minWidth: 120,
            },
            {
                colId: ColId.actions,
                ...AgIconActionsCell.getCellSchema<RowEntity>({
                    actions: ({ rowData }) => [
                        {
                            icon: 'epic-pencil',
                            tooltip: 'Edit',
                            onClick: () => ({
                                eventName: CellEventEvent.Edit,
                            }),
                        },
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
            getRowId: ({ data }) => data.id.toString(),
        }
    }

}


