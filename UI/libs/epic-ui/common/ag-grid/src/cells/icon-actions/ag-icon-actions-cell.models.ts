import { ColDef, ICellRendererParams } from 'ag-grid-community'
import { EpicActionsMenu } from 'epic-ui/common/components'
import { GenericEventInfo, EpicRecord } from 'epic-ui/utils'
import { Observable } from 'rxjs'

import { EpicAgGridCell } from '../../core'


export namespace AgIconActionsCell {

    export const TYPE = 'AgIconActionsCell'

    export type Action = {
        icon: string
        tooltip?: string
        tooltipI18nParams?: any
        disabled?: boolean
        onClick?: () => GenericEventInfo
        menuActions?: MenuAction[]
        // router link
        routerLink?: string | any[]
        routerQueryParams?: any[]
        target?: string
    }

    export type MenuAction = EpicActionsMenu.Action

    export type CellExtraParams<TRowData = EpicRecord, TCellValue = any> = {
        actions?: EpicAgGridCell.CellParamValueGetter<Action[] | Observable<Action[]>, TRowData, TCellValue>
    }

    export type CellParams = CellExtraParams & ICellRendererParams

    export function getCellSchema<TRowData = EpicRecord, TCellValue = any>(
        params: CellExtraParams<TRowData, TCellValue>,
    ): ColDef<TRowData, TCellValue> {
        return {
            cellRenderer: TYPE,
            cellRendererParams: params,
            headerName: '',
            sortable: false,
            filter: false,
            resizable: false,
            suppressHeaderMenuButton: true,
            pivot: false,
            enablePivot: false,
            suppressFiltersToolPanel: true,
            suppressColumnsToolPanel: true,
            suppressMovable: true,
            lockPinned: true,
            pinned: 'right',
            cellClass: EpicAgGridCell.CELL_WRAP_NO_PADDING_CLASS,
            width: getCellWidth(1),
        }
    }

    export function getCellWidth(iconsCount: number): number {
        if (iconsCount < 1) {
            throw new Error('Invalid argument: iconsCount > 0')
        }
        if (iconsCount === 1) {
            return 40
        }
        else {
            return 32 * (iconsCount - 1) + getCellWidth(1) + 2
        }
    }

    export function getMoreAction(menuActions?: MenuAction[]): Action {
        return {
            icon: 'epic-more-actions',
            menuActions,
        }
    }

}
