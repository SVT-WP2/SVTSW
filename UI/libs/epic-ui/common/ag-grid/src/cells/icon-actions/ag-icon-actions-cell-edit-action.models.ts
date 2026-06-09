import { ColDef } from 'ag-grid-community'
import { EpicRecord } from 'epic-ui/utils'

import { EpicAgGridCell } from '../../core'

import { AgIconActionsCell } from './ag-icon-actions-cell.models'


export namespace AgIconActionsCellEditAction {

    export function getIconAction(iconAction: AgIconActionsCell.Action | null): AgIconActionsCell.Action {
        return {
            icon: iconAction?.disabled ? 'epic-pencil-cross' : 'epic-pencil',
            tooltip: 'COMMON.EDIT',
            ...(iconAction || {}),
        }
    }

    export function getCellSchema<TRowData = EpicRecord, TCellValue = any>(
        iconAction: EpicAgGridCell.CellParamValueGetter<AgIconActionsCell.Action, TRowData, TCellValue>,
    ): ColDef {
        return {
            ...AgIconActionsCell.getCellSchema<TRowData, TCellValue>({
                actions: (args) => {
                    const iconActionResult = EpicAgGridCell.getCellParamValue(iconAction, args)

                    return [getIconAction(iconActionResult)]
                },
            }),
            pinned: 'left',
            width: 40,
        }
    }

}
