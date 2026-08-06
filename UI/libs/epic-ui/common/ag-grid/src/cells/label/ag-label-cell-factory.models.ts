import { ColDef } from 'ag-grid-community'
import { EpicRecord } from 'epic-ui/utils'

import { EpicAgGridFilter } from '../../core'

import { AgLabelCellComponent } from './ag-label-cell.component'
import { AgLabelCell } from './ag-label-cell.models'


export namespace AgLabelCellFactory {

    export function createCellSchema<TRowData = EpicRecord, TCellValue = any>(
        extraParams?: AgLabelCell.CellExtraParams<TRowData, TCellValue>,
    ): ColDef<TRowData, TCellValue> {
        return {
            cellRenderer: AgLabelCellComponent,
            cellRendererParams: extraParams || {},
            ...EpicAgGridFilter.getCommonTextFilter(),
        }
    }

}


