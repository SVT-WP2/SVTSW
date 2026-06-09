import { ColDef, GridOptions, ICellRendererParams } from 'ag-grid-community'
import { EpicWaferTestStatus } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'
import { toEpicMatOutlinedIcon } from 'epic-ui/common/components'
import moment from 'moment'

import { EpicWaferTestExtended } from './epic-wafer-test-extended.models'


export namespace EpicWaferTestsGrid {

    export enum ColId {
        id = 'id',
        status = 'status',
        name = 'name',
        createdAt = 'createdAt',
        startedAt = 'startedAt',
        finishedAt = 'finishedAt',
        actions = 'actions',
    }

    export type RowEntity = EpicWaferTestExtended

    export function getStatusColorCssClassName(status: EpicWaferTestStatus): string {
        switch (status) {
            case EpicWaferTestStatus.Processing:
                return 'epic-color-info-400'
            case EpicWaferTestStatus.Aborted:
                return 'epic-color-warning-300'
            case EpicWaferTestStatus.Done:
                return 'epic-color-success-300'
            case EpicWaferTestStatus.Error:
                return 'epic-color-error-300'
            case EpicWaferTestStatus.None:
                return 'epic-color-neutral-90'
            default:
                return 'epic-color-neutral-900'
        }
    }

    export enum CellEventEvent {
        Details = 'Details',
        Repeat = 'Repeat',
        Delete = 'Delete',
        Start = 'Start',
    }

    export function getColDefs(): ColDef[] {
        return [
            {
                field: ColId.id,
                headerName: 'ID',
                maxWidth: 100,
                sort: 'desc',
            },
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
                field: ColId.createdAt,
                headerName: 'Created At',
                filter: 'agDateColumnFilter',
                minWidth: 200,
                valueFormatter: (params) => params.value ? moment(params.value).format('DD.MM.YY - HH:mm:ss') : '-',
            },
            {
                colId: ColId.actions,
                ...AgIconActionsCell.getCellSchema<RowEntity>({
                    actions: ({ rowData }) => [
                        {
                            icon: rowData.status === EpicWaferTestStatus.None
                                ? toEpicMatOutlinedIcon('play_circle')
                                : toEpicMatOutlinedIcon('stop'),
                            onClick: () => ({
                                eventName: CellEventEvent.Start,
                            }),
                            tooltip: rowData.status === EpicWaferTestStatus.None ? 'Start' : 'Stop',
                            disabled: [EpicWaferTestStatus.Done, EpicWaferTestStatus.Aborted].includes(rowData.status),
                        },
                        AgIconActionsCell.getMoreAction([
                            {
                                icon: 'epic-eye-open',
                                title: 'Details',
                                onClick: () => ({
                                    eventName: CellEventEvent.Details,
                                }),
                            },
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
        }
    }

}
