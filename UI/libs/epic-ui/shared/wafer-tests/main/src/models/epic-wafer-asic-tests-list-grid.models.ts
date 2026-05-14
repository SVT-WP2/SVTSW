import { ColDef, GridOptions, ICellRendererParams } from 'ag-grid-community'
import { EpicAsicTestStatus } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'
import moment from 'moment'

import { EpicAsicTestExtended } from './epic-asic-test-extended.models'


export namespace EpicWaferAsicTestsListGrid {

    export enum ColId {
        id = 'id',
        status = 'status',
        serialNumber = 'serialNumber',
        startedAt = 'startedAt',
        finishedAt = 'finishedAt',
        actions = 'actions',
    }

    export type RowEntity = EpicAsicTestExtended

    export function getStatusColorCssClassName(status: EpicAsicTestStatus): string {
        switch (status) {
            case EpicAsicTestStatus.Processing:
                return 'epic-color-info-400'
            case EpicAsicTestStatus.Aborted:
                return 'epic-color-warning-300'
            case EpicAsicTestStatus.Done:
                return 'epic-color-success-300'
            case EpicAsicTestStatus.Error:
                return 'epic-color-error-300'
            case EpicAsicTestStatus.None:
                return 'epic-color-neutral-90'
            default:
                return 'epic-color-neutral-900'
        }
    }

    export enum CellEventEvent {
        Details = 'Details',
        Repeat = 'Repeat',
        Delete = 'Delete',
    }

    export function getColDefs(): ColDef[] {
        return [
            {
                field: ColId.id,
                headerName: 'ID',
                maxWidth: 100,
                sort: 'asc',
            },
            {
                field: ColId.status,
                headerName: 'Status',
                cellRenderer: (params: ICellRendererParams) => {
                    const className = getStatusColorCssClassName(params.value)
                    return `<span class="${className}">${params.value === EpicAsicTestStatus.None ? 'Waiting ...' : params.value}</span>`
                },
                cellStyle: ({ value }) => ({
                    'font-weight': '500',
                    'letter-spacing': '0.1em',
                }),
            },
            {
                colId: ColId.serialNumber,
                field: 'asic.serialNumber',
                headerName: 'ASIC',
                flex: 1,
            },
            {
                field: ColId.startedAt,
                headerName: 'Started At',
                filter: 'agDateColumnFilter',
                minWidth: 200,
                valueFormatter: (params) => params.value ? moment(params.value).format('DD.MM.YY - HH:mm:ss') : '',
            },
            {
                field: ColId.finishedAt,
                headerName: 'Finished At',
                filter: 'agDateColumnFilter',
                minWidth: 200,
                valueFormatter: (params) => params.value ? moment(params.value).format('DD.MM.YY - HH:mm:ss') : '-',
            },
            {
                colId: ColId.actions,
                ...AgIconActionsCell.getCellSchema<RowEntity>({
                    actions: ({ rowData }) => [
                        ...(
                            rowData.status !== EpicAsicTestStatus.None
                                ? [{
                                    icon: 'epic-eye-open',
                                    onClick: () => ({
                                        eventName: CellEventEvent.Details,
                                    }),
                                    tooltip: 'Details',
                                }]
                                : []
                        ),
                        // AgIconActionsCell.getMoreAction([
                        //     {
                        //         icon: 'epic-refresh',
                        //         title: 'Repeat',
                        //         onClick: () => ({
                        //             eventName: CellEventEvent.Repeat,
                        //         }),
                        //     },
                        //     {
                        //         icon: 'epic-delete',
                        //         title: 'Delete',
                        //         onClick: () => ({
                        //             eventName: CellEventEvent.Delete,
                        //         }),
                        //     },
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
        }
    }

}
