import { ICellRendererParams } from 'ag-grid-community'
import { EpicRecord } from 'epic-ui/utils'
import { Observable } from 'rxjs'

import { EpicAgGridCell } from '../../core'


export namespace AgLinkCell {

    export const TYPE = 'AgLinkCell'

    export type Config = {
        routerLink?: string | any[]
        queryParams?: EpicRecord
        target?: string
        tooltip?: string
        tooltipI18nParams?: EpicRecord
        disabled?: boolean
        emptyValuePlaceholder?: string
    }

    export type CellExtraParams<TRowData = EpicRecord, TCellValue = any> = {
        config?: EpicAgGridCell.CellParamValueGetter<Config | Observable<Config>, TRowData, TCellValue>
    }

    export type CellParams = CellExtraParams & ICellRendererParams

    export type State =
        & Config
        &
        {
            value: string | undefined
        }

    export function getDefaultConfig(): Config {
        return {
            emptyValuePlaceholder: '-',
        }
    }

    export function toState(value: string | undefined, config: Config): State {
        return {
            ...config,
            value,
        }
    }

}
