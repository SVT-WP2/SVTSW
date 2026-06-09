import { GridOptions } from 'ag-grid-community'

import { EpicAgGridCell } from './epic-ag-grid-cell.models'


export namespace EpicAgGrid {

    export function getDefaultGridOptions<TRowData = any>(isServerSide = false, disallowGroupBy?: string[]): GridOptions<TRowData> {
        return {
            rowGroupPanelShow: 'onlyWhenGrouping',
            floatingFiltersHeight: 40,
            groupHeaderHeight: 40,
            rowHeight: 40,
            headerHeight: 40,
            accentedSort: true,
            paginationAutoPageSize: true,
            getRowId: (params) => {
                const rowData = params.data as any
                const value = rowData?.uid || rowData?.id || rowData
                return JSON.stringify(value)
            },
            pagination: true,
            rowSelection: 'multiple',
            suppressCellFocus: true,
            cellSelection: false,
            animateRows: false,
            tooltipShowDelay: 1000,
            tooltipHideDelay: 1000000, // there is no way how to remove tooltip auto hiding
            defaultColDef: {
                sortable: true,
                filter: true,
                floatingFilter: true,
                resizable: true,
                enableValue: false,
            },
            enableCellTextSelection: true,
            columnTypes: {
                [EpicAgGridCell.DefaultCellType.dateTimeColumn]: {},
            },
            rowModelType: isServerSide ? 'serverSide' : 'clientSide',
        }
    }

}
