import { ColDef, GridOptions } from 'ag-grid-community'
import {
    EpicSvtDutEntityName,
    EpicSvtTest,
    EpicSvtTestResultStatus,
    EpicSvtTestSetup,
    EpicSvtTestSetupConfig,
    EpicSvtTestStatus,
    EpicSvtTestType,
    EpicSvtTestTypeConfig,
} from 'epic-ui/api'
import {
    AgIconActionsCell,
    AgIconActionsCellComponent,
    AgLabelCell,
    AgLabelCellFactory,
    AgLinkCell,
    AgLinkCellFactory,
    AgSkeletonCell,
    EpicAgGrid,
} from 'epic-ui/common/ag-grid'
import { toEpicMatOutlinedIcon } from 'epic-ui/common/components'
import { DEFAULT_SYSTEM_COLORS } from 'epic-ui/utils/colors'
import { keyBy } from 'lodash-es'
import moment from 'moment'


export namespace EpicSvtTestsGrid {

    export enum ColId {
        id = 'id',
        status = 'status',
        testResultStatus = 'testResultStatus',
        dutEntityName = 'dutEntityName',
        dutId = 'dutId',
        testType = 'testType.name',
        testTypeConfig = 'testTypeConfig.name',
        testSetup = 'testSetup.name',
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
            testType: EpicSvtTestType | null
            testTypeConfig: EpicSvtTestTypeConfig | null
            testSetup: EpicSvtTestSetup | null
            testSetupConfig: EpicSvtTestSetupConfig | null
        }

    /** Everything a test refers to by id — all of it comes from the cached facades, none of it is paginated. */
    export type RowEntityRelations = {
        testSetupConfigs: EpicSvtTestSetupConfig[]
        testSetups: EpicSvtTestSetup[]
        testTypeConfigs: EpicSvtTestTypeConfig[]
        testTypes: EpicSvtTestType[]
    }

    export enum CellEventEvent {
        Details = 'Details',
        Start = 'Start',
    }

    /**
     * How many rows one block holds, i.e. how many rows a single API call brings in. The grid keeps every block
     * it has loaded, so this is the size of one round trip, not a cap on what the user can scroll through.
     */
    export const BLOCK_SIZE = 100

    /**
     * A test only knows the ids of its two configs — the test type and the test setup they belong to are the
     * ones of the config, so they are resolved through it rather than looked up on the test itself.
     */
    export function toRowEntities(tests: EpicSvtTest[], relations: RowEntityRelations): RowEntity[] {
        const testSetupConfigsMap = keyBy(relations.testSetupConfigs, 'id')
        const testSetupsMap = keyBy(relations.testSetups, 'id')
        const testTypeConfigsMap = keyBy(relations.testTypeConfigs, 'id')
        const testTypesMap = keyBy(relations.testTypes, 'id')

        return tests.map((item) => {
            const testTypeConfig = testTypeConfigsMap[item.testTypeConfigId] || null
            const testSetupConfig = testSetupConfigsMap[item.testSetupConfigId] || null

            return {
                ...item,
                testType: testTypeConfig ? testTypesMap[testTypeConfig.testTypeId] || null : null,
                testTypeConfig,
                testSetup: testSetupConfig ? testSetupsMap[testSetupConfig.setupId] || null : null,
                testSetupConfig,
            } satisfies RowEntity
        })
    }

    /**
     * The status is undefined while the row is still an unloaded placeholder of the infinite row model — every
     * cell config getter here has to survive a row without data.
     */
    /** Colours a status wears, the very same ones in the grid cell and in the statistics boxes above it. */
    export type StatusLabelConfig = Required<Pick<AgLabelCell.Config, 'color' | 'bgColor'>>

    export function getStatusLabelConfig(status: EpicSvtTestStatus | undefined): StatusLabelConfig {
        switch (status) {
            case EpicSvtTestStatus.Completed:
                return { color: DEFAULT_SYSTEM_COLORS.SUCCESS_400, bgColor: DEFAULT_SYSTEM_COLORS.SUCCESS_50 }
            case EpicSvtTestStatus.Running:
                return { color: DEFAULT_SYSTEM_COLORS.INFO_400, bgColor: DEFAULT_SYSTEM_COLORS.INFO_50 }
            case EpicSvtTestStatus.Failed:
                return { color: DEFAULT_SYSTEM_COLORS.ERROR_400, bgColor: DEFAULT_SYSTEM_COLORS.ERROR_50 }
            case EpicSvtTestStatus.Cancelled:
                return { color: DEFAULT_SYSTEM_COLORS.WARNING_400, bgColor: DEFAULT_SYSTEM_COLORS.WARNING_50 }
            // EpicSvtTestStatus.Pending and the not yet loaded row
            default:
                return { color: DEFAULT_SYSTEM_COLORS.NEUTRAL_300, bgColor: DEFAULT_SYSTEM_COLORS.NEUTRAL_30 }
        }
    }

    export function getResultStatusLabelConfig(resultStatus: EpicSvtTestResultStatus | undefined): StatusLabelConfig {
        switch (resultStatus) {
            case EpicSvtTestResultStatus.Completed:
                return { color: DEFAULT_SYSTEM_COLORS.SUCCESS_400, bgColor: DEFAULT_SYSTEM_COLORS.SUCCESS_50 }
            case EpicSvtTestResultStatus.Failed:
                return { color: DEFAULT_SYSTEM_COLORS.ERROR_400, bgColor: DEFAULT_SYSTEM_COLORS.ERROR_50 }
            case EpicSvtTestResultStatus.Cancelled:
                return { color: DEFAULT_SYSTEM_COLORS.WARNING_400, bgColor: DEFAULT_SYSTEM_COLORS.WARNING_50 }
            // EpicSvtTestResultStatus.None and the not yet loaded row
            default:
                return { color: DEFAULT_SYSTEM_COLORS.NEUTRAL_300, bgColor: DEFAULT_SYSTEM_COLORS.NEUTRAL_30 }
        }
    }

    /**
     * The DUT is one of three different entities and `dutId` is only unique per entity, so `dutEntityName` is
     * what decides which details page the id belongs to.
     */
    export function getDutLinkConfig(
        dutEntityName: EpicSvtDutEntityName | undefined, dutId: number | undefined): AgLinkCell.Config {

        if (!dutEntityName || !dutId) {
            return {}
        }

        switch (dutEntityName) {
            case EpicSvtDutEntityName.Asic:
                return { routerLink: ['/asics/details', dutId], tooltip: 'Open ASIC' }
            case EpicSvtDutEntityName.Chip:
                return { routerLink: ['/chips/details', dutId], tooltip: 'Open Chip' }
            case EpicSvtDutEntityName.ChipBlock:
                return { routerLink: ['/chip-blocks/details', dutId], tooltip: 'Open Chip Block' }
            default:
                return {}
        }
    }

    export function getTestTypeLinkConfig(testType: EpicSvtTestType | null): AgLinkCell.Config {
        return {
            routerLink: testType
                ? ['/admin/svt-test/test-types/details', testType.id]
                : undefined,
            tooltip: testType ? 'Open Test Type' : undefined,
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

    export function getTestSetupLinkConfig(testSetup: EpicSvtTestSetup | null): AgLinkCell.Config {
        return {
            routerLink: testSetup
                ? ['/admin/svt-test/test-setups/details', testSetup.id]
                : undefined,
            tooltip: testSetup ? 'Open Test Setup' : undefined,
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

    /** Columns a caller does not want. A page that already is one single DUT has no use for the DUT ones. */
    export type ColDefsOptions = {
        excludeColIds?: ColId[]
    }

    export function getColDefs(options: ColDefsOptions = {}): ColDef<RowEntity>[] {
        const excludeColIds = options.excludeColIds || []
        const colDefs: ColDef<RowEntity>[] = [
            {
                field: ColId.id,
                headerName: 'ID',
                minWidth: 80,
                width: 80,
            },
            {
                ...AgLabelCellFactory.createCellSchema<RowEntity, EpicSvtTestStatus>({
                    config: ({ rowData }) => getStatusLabelConfig(rowData?.status),
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
                ...AgLinkCellFactory.createCellSchema<RowEntity, number>({
                    config: ({ rowData }) => getDutLinkConfig(rowData?.dutEntityName, rowData?.dutId),
                }),
                filter: false,
                field: ColId.dutId,
                headerName: 'DUT ID',
                minWidth: 80,
            },
            {
                ...AgLinkCellFactory.createCellSchema<RowEntity, string>({
                    config: ({ rowData }) => getTestTypeLinkConfig(rowData?.testType || null),
                }),
                filter: false,
                field: ColId.testType,
                headerName: 'Test Type',
                flex: 1,
                minWidth: 180,
            },
            {
                ...AgLinkCellFactory.createCellSchema<RowEntity, string>({
                    config: ({ rowData }) => getTestTypeConfigLinkConfig(rowData?.testTypeConfig || null),
                }),
                filter: false,
                field: ColId.testTypeConfig,
                headerName: 'Test Type Config',
                flex: 1,
                minWidth: 220,
            },
            {
                ...AgLinkCellFactory.createCellSchema<RowEntity, string>({
                    config: ({ rowData }) => getTestSetupLinkConfig(rowData?.testSetup || null),
                }),
                filter: false,
                field: ColId.testSetup,
                headerName: 'Test Setup',
                flex: 1,
                minWidth: 180,
            },
            {
                ...AgLinkCellFactory.createCellSchema<RowEntity, string>({
                    config: ({ rowData }) => getTestSetupConfigLinkConfig(rowData?.testSetupConfig || null),
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
                            disabled: rowData?.status !== EpicSvtTestStatus.Pending,
                            tooltip: 'Start',
                        },
                        {
                            icon: toEpicMatOutlinedIcon('stop_circle'),
                            onClick: () => ({
                                eventName: CellEventEvent.Start,
                            }),
                            disabled: rowData?.status !== EpicSvtTestStatus.Running,
                            tooltip: 'Start',
                        },
                    ],
                }),
                width: AgIconActionsCell.getCellWidth(2),
                cellRenderer: AgIconActionsCellComponent,
            },
        ]

        return colDefs.filter(item => !excludeColIds.includes((item.colId || item.field) as ColId))
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
                // rows of a block that is still on its way are filled with skeleton bars
                cellRendererSelector: AgSkeletonCell.getLoadingCellRendererSelector<RowEntity>(),
            },
            getRowId: ({ data }) => data.id.toString(),
            // rows are fetched block by block from the paginated endpoint as the user scrolls, never all at once
            rowModelType: 'infinite',
            cacheBlockSize: BLOCK_SIZE,
            // a pager over blocks the grid has not loaded yet makes no sense — the list scrolls instead
            pagination: false,
            paginationAutoPageSize: false,
            // dragging the scrollbar across many blocks must not fire a request for every one of them
            blockLoadDebounceMillis: 200,
        }
    }

    /**
     * Grid options of a list that already holds every row it will ever show — see `EpicSvtDutTestsDataSource`.
     * Sorting and paging are the grid's own here, while filtering stays with the filter bar above it. The rows
     * arrive newest first, which is the order the grid keeps as long as no column is sorted by hand.
     */
    export function getClientSideGridOptions(): GridOptions<RowEntity> {
        const defaultGridOptions = EpicAgGrid.getDefaultGridOptions<RowEntity>()

        return {
            ...defaultGridOptions,
            rowSelection: undefined,
            defaultColDef: {
                ...defaultGridOptions.defaultColDef,
                filter: false,
                floatingFilter: false,
            },
            getRowId: ({ data }) => data.id.toString(),
        }
    }


}
