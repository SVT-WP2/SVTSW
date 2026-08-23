import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicSvtTest, EpicSvtTestResultStatus, EpicSvtTestSetupConfig, EpicSvtTestStatus, EpicSvtTestTypeConfig } from 'epic-ui/api'
import {
    AgIconActionsCell,
    AgIconActionsCellComponent,
    AgLabelCell,
    AgLabelCellFactory,
    AgLinkCell,
    AgLinkCellFactory,
    EpicAgGrid,
} from 'epic-ui/common/ag-grid'
import { toEpicMatOutlinedIcon } from 'epic-ui/common/components'
import { DEFAULT_SYSTEM_COLORS } from 'epic-ui/utils/colors'
import moment from 'moment'


export namespace EpicSvtTestsGrid {

    export enum ColId {
        id = 'id',
        status = 'status',
        testResultStatus = 'testResultStatus',
        dutEntityName = 'dutEntityName',
        dutId = 'dutId',
        testTypeConfig = 'testTypeConfig.name',
        testSetupConfig = 'testSetupConfig.name',
        createdAt = 'createdAt',
        startedAt = 'startedAt',
        finishedAt = 'finishedAt',
        pathToResult = 'pathToResult',
        actions = 'actions',
    }

    export type RowEntity =
        & EpicSvtTest
        &
        {
            testTypeConfig: EpicSvtTestTypeConfig | null
            testSetupConfig: EpicSvtTestSetupConfig | null
        }

    export enum CellEventEvent {
        Details = 'Details',
        Start = 'Start',
    }

    export function getStatusLabelConfig(status: EpicSvtTestStatus): AgLabelCell.Config {
        switch (status) {
            case EpicSvtTestStatus.Completed:
                return { color: DEFAULT_SYSTEM_COLORS.SUCCESS_400, bgColor: DEFAULT_SYSTEM_COLORS.SUCCESS_50 }
            case EpicSvtTestStatus.Running:
                return { color: DEFAULT_SYSTEM_COLORS.INFO_400, bgColor: DEFAULT_SYSTEM_COLORS.INFO_50 }
            case EpicSvtTestStatus.Pending:
                return { color: DEFAULT_SYSTEM_COLORS.NEUTRAL_300, bgColor: DEFAULT_SYSTEM_COLORS.NEUTRAL_30 }
            case EpicSvtTestStatus.Failed:
                return { color: DEFAULT_SYSTEM_COLORS.ERROR_400, bgColor: DEFAULT_SYSTEM_COLORS.ERROR_50 }
            case EpicSvtTestStatus.Cancelled:
                return { color: DEFAULT_SYSTEM_COLORS.WARNING_400, bgColor: DEFAULT_SYSTEM_COLORS.WARNING_50 }
        }
    }

    export function getResultStatusLabelConfig(resultStatus: EpicSvtTestResultStatus): AgLabelCell.Config {
        switch (resultStatus) {
            case EpicSvtTestResultStatus.Completed:
                return { color: DEFAULT_SYSTEM_COLORS.SUCCESS_400, bgColor: DEFAULT_SYSTEM_COLORS.SUCCESS_50 }
            case EpicSvtTestResultStatus.Failed:
                return { color: DEFAULT_SYSTEM_COLORS.ERROR_400, bgColor: DEFAULT_SYSTEM_COLORS.ERROR_50 }
            case EpicSvtTestResultStatus.Cancelled:
                return { color: DEFAULT_SYSTEM_COLORS.WARNING_400, bgColor: DEFAULT_SYSTEM_COLORS.WARNING_50 }
            case EpicSvtTestResultStatus.None:
                return { color: DEFAULT_SYSTEM_COLORS.NEUTRAL_300, bgColor: DEFAULT_SYSTEM_COLORS.NEUTRAL_30 }
        }
    }

    export function getTestTypeConfigLinkConfig(testTypeConfig: EpicSvtTestTypeConfig | null): AgLinkCell.Config {
        return {
            routerLink: testTypeConfig
                ? ['/admin/svt-test/test-types/details', testTypeConfig.testTypeId, 'config', testTypeConfig.id]
                : undefined,
            tooltip: testTypeConfig ? 'Open Test Type Config' : undefined,
        }
    }

    export function getTestSetupConfigLinkConfig(testSetupConfig: EpicSvtTestSetupConfig | null): AgLinkCell.Config {
        return {
            routerLink: testSetupConfig
                ? ['/admin/svt-test/test-setups/details', testSetupConfig.setupId, 'config', testSetupConfig.id]
                : undefined,
            tooltip: testSetupConfig ? 'Open Test Setup Config' : undefined,
        }
    }

    export function getColDefs(): ColDef<RowEntity>[] {
        return [
            {
                field: ColId.id,
                headerName: 'ID',
                minWidth: 80,
                width: 80,
                sort: 'desc',
            },
            {
                ...AgLabelCellFactory.createCellSchema<RowEntity, EpicSvtTestStatus>({
                    config: ({ rowData }) => getStatusLabelConfig(rowData.status),
                }),
                filter: false,
                field: ColId.status,
                headerName: 'Status',
                minWidth: 120,
                width: 120,
            },
            {
                field: ColId.dutEntityName,
                headerName: 'DUT Entity',
                minWidth: 120,
            },
            {
                field: ColId.dutId,
                headerName: 'DUT ID',
                minWidth: 80,
            },
            {
                ...AgLinkCellFactory.createCellSchema<RowEntity, string>({
                    config: ({ rowData }) => getTestTypeConfigLinkConfig(rowData.testTypeConfig),
                }),
                filter: false,
                field: ColId.testTypeConfig,
                headerName: 'Test Type Config',
                flex: 1,
                minWidth: 220,
            },
            {
                ...AgLinkCellFactory.createCellSchema<RowEntity, string>({
                    config: ({ rowData }) => getTestSetupConfigLinkConfig(rowData.testSetupConfig),
                }),
                filter: false,
                field: ColId.testSetupConfig,
                headerName: 'Test Setup Config',
                flex: 1,
                minWidth: 220,
            },
            {
                field: ColId.createdAt,
                headerName: 'Created At',
                minWidth: 200,
                valueFormatter: (params) => params.value ? moment(params.value).format('DD.MM.YY - HH:mm:ss') : '-',
            },
            {
                field: ColId.startedAt,
                headerName: 'Started At',
                minWidth: 200,
                valueFormatter: (params) => params.value ? moment(params.value).format('DD.MM.YY - HH:mm:ss') : '-',
            },
            {
                field: ColId.finishedAt,
                headerName: 'Finished At',
                minWidth: 200,
                valueFormatter: (params) => params.value ? moment(params.value).format('DD.MM.YY - HH:mm:ss') : '-',
            },
            {
                field: ColId.pathToResult,
                headerName: 'Path To Result',
                minWidth: 200,
                valueFormatter: ({ value }) => (value as string) || '-',
            },
            {
                colId: ColId.actions,
                ...AgIconActionsCell.getCellSchema<RowEntity>({
                    actions: ({ rowData }) => [
                        {
                            icon: toEpicMatOutlinedIcon('play_circle'),
                            onClick: () => ({
                                eventName: CellEventEvent.Start,
                            }),
                            color: DEFAULT_SYSTEM_COLORS.SUCCESS_300,
                            disabled: rowData.status !== EpicSvtTestStatus.Pending,
                            tooltip: 'Start',
                        },
                        {
                            icon: toEpicMatOutlinedIcon('stop_circle'),
                            onClick: () => ({
                                eventName: CellEventEvent.Start,
                            }),
                            disabled: rowData.status !== EpicSvtTestStatus.Running,
                            tooltip: 'Start',
                        },
                    ],
                }),
                width: AgIconActionsCell.getCellWidth(2),
                cellRenderer: AgIconActionsCellComponent,
            },
        ]
    }

    export function getGridOptions(): GridOptions<RowEntity> {
        const defaultGridOptions = EpicAgGrid.getDefaultGridOptions<RowEntity>()

        return {
            ...defaultGridOptions,
            rowSelection: undefined,
            // the list is filtered / ordered by the API — no client side sorting or filtering here
            defaultColDef: {
                ...defaultGridOptions.defaultColDef,
                sortable: false,
                filter: false,
                floatingFilter: false,
            },
            getRowId: ({ data }) => data.id.toString(),
        }
    }


}
