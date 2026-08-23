import { ColDef } from 'ag-grid-community'
import { EpicRecord } from 'epic-ui/utils'

import { EpicAgGridFilter } from '../../core'

import { AgLinkCellComponent } from './ag-link-cell.component'
import { AgLinkCell } from './ag-link-cell.models'


export namespace AgLinkCellFactory {

    export function createCellSchema<TRowData = EpicRecord, TCellValue = any>(
        extraParams?: AgLinkCell.CellExtraParams<TRowData, TCellValue>,
    ): ColDef<TRowData, TCellValue> {
        return {
            cellRenderer: AgLinkCellComponent,
            cellRendererParams: extraParams || {},
            ...EpicAgGridFilter.getCommonTextFilter(),
        }
    }

}
