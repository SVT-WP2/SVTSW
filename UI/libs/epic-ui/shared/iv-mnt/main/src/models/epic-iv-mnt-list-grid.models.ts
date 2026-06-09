import { ColDef, GridOptions, ICellRendererParams } from 'ag-grid-community'
import { EpicIvMnt, EpicMntStatus } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'
import moment from 'moment'


export namespace EpicIvMntListGrid {

    export enum ColId {
        id = 'id',
        status = 'status',
        name = 'name',
        labels = 'labels',
        startedAt = 'startedAt',
        finishedAt = 'finishedAt',
        actions = 'actions',
    }

    export type RowEntity = EpicIvMnt

    export function getStatusColorCssClassName(status: EpicMntStatus): string {
        switch (status) {
            case EpicMntStatus.Processing:
                return 'epic-color-info-400'
            case EpicMntStatus.Aborted:
                return 'epic-color-warning-300'
            case EpicMntStatus.Done:
                return 'epic-color-success-300'
            case EpicMntStatus.Error:
                return 'epic-color-error-300'
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
            // {
            //     field: ColId.id,
            //     headerName: 'ID',
            // },
            {
                field: ColId.status,
                headerName: 'Status',
                cellRenderer: (params: ICellRendererParams) => {
                    const className = getStatusColorCssClassName(params.value)
                    return `<span class="${className}">${params.value}</span>`
                },
                cellStyle: ({ value }) => ({
                    'font-weight': '500',
                    'letter-spacing': '0.1em',
                }),
            },
            {
                field: ColId.name,
                headerName: 'Name',
                flex: 1,
            },
            {
                field: ColId.labels,
                headerName: 'Labels',
            },
            {
                field: ColId.startedAt,
                headerName: 'Started At',
                filter: 'agDateColumnFilter',
                sort: 'desc',
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
                        {
                            icon: 'epic-eye-open',
                            onClick: () => ({
                                eventName: CellEventEvent.Details,
                            }),
                            tooltip: 'Details',
                        },
                        AgIconActionsCell.getMoreAction([
                            {
                                icon: 'epic-refresh',
                                title: 'Repeat',
                                onClick: () => ({
                                    eventName: CellEventEvent.Repeat,
                                }),
                            },
                            {
                                icon: 'epic-delete',
                                title: 'Delete',
                                onClick: () => ({
                                    eventName: CellEventEvent.Delete,
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
            pagination: false,
            domLayout: 'autoHeight',
        }
    }

}
