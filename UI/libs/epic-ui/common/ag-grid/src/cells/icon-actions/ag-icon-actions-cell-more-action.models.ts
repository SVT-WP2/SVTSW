import { ColDef } from 'ag-grid-community'
import { EpicActionsMenu } from 'epic-ui/common/components'
import { EpicRecord } from 'epic-ui/utils'

import { EpicAgGridCell } from '../../core'

import { AgIconActionsCell } from './ag-icon-actions-cell.models'


export namespace AgIconActionsCellMoreAction {

    export function getIconAction(menuActions: EpicActionsMenu.ActionsList): AgIconActionsCell.Action {
        return {
            icon: 'more_vert',
            menuActions: menuActions,
        }
    }

    export function getCellSchema<TRowData = EpicRecord, TCellValue = any>(
        menuActions: EpicAgGridCell.CellParamValueGetter<EpicActionsMenu.ActionsList, TRowData, TCellValue>,
    ): ColDef {
        return {
            ...AgIconActionsCell.getCellSchema<TRowData, TCellValue>({
                actions: (args) => {
                    const menuActionsResult = EpicAgGridCell.getCellParamValue(menuActions, args)
                    return menuActionsResult?.length
                        ? [getIconAction(menuActionsResult)]
                        : []
                },
            }),
            width: 40,
        }
    }

}
