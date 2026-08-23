import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicSvtTestType, EpicSvtTestTypeConfig } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, AgLinkCellFactory, EpicAgGrid } from 'epic-ui/common/ag-grid'


export namespace EpicSvtTestTypesGrid {

    export enum ColId {
        id = 'id',
        name = 'name',
        dutTypes = 'dutTypes',
        actions = 'actions',
    }

    export type RowEntity = EpicSvtTestType

    export enum CellEventEvent {
        Details = 'Details',
    }

    // a test type is always opened on one of its configs — there is no default one, so the first is taken
    export function getDetailsRouterLink(rowData: RowEntity, testTypeConfigs: EpicSvtTestTypeConfig[]): (string | number)[] {
        const refConfig = testTypeConfigs.find(item => item.testTypeId === rowData.id)
        return ['../details', rowData.id, 'config', refConfig?.id ?? 0]
    }

    export function getColDefs(testTypeConfigs: EpicSvtTestTypeConfig[] = []): ColDef[] {
        return [
            {
                field: ColId.id,
                headerName: 'ID',
                minWidth: 80,
            },
            {
                ...AgLinkCellFactory.createCellSchema<RowEntity, string>({
                    config: ({ rowData }) => ({
                        routerLink: getDetailsRouterLink(rowData, testTypeConfigs),
                        tooltip: 'Details',
                    }),
                }),
                field: ColId.name,
                headerName: 'Name',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.dutTypes,
                headerName: 'DUT Types',
                flex: 1,
                minWidth: 200,
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
