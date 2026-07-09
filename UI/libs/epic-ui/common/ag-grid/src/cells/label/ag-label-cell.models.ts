import { ICellRendererParams } from 'ag-grid-community'
import { EpicRecord } from 'epic-ui/utils'
import { DEFAULT_SYSTEM_COLORS, ISystemColors } from 'epic-ui/utils/colors'
import { Observable } from 'rxjs'

import { EpicAgGridCell } from '../../core'


export namespace AgLabelCell {

    export const TYPE = 'AgLabelCell'

    export type Config = {
        color?: string
        bgColor?: string
        iconName?: string
        tooltip?: string
        tooltipI18nParams?: EpicRecord
    }

    export type CellExtraParams<TRowData = EpicRecord, TCellValue = any> = {
        config?: EpicAgGridCell.CellParamValueGetter<Config | Observable<Config>, TRowData, TCellValue>
    }

    export type CellParams = CellExtraParams & ICellRendererParams

    export type State = {
        value: string | undefined
        color: string
        bgColor: string
        iconName?: string
        tooltip?: string
        tooltipI18nParams?: EpicRecord
    }

    export function getDefaultConfig(systemColors?: ISystemColors): Config {
        return {
            color: (systemColors || DEFAULT_SYSTEM_COLORS).NEUTRAL_300,
            bgColor: (systemColors || DEFAULT_SYSTEM_COLORS).NEUTRAL_30,
        }
    }

    export function toState(value: string | undefined, config: Config): State {
        return {
            value,
            color: config.color,
            bgColor: config.bgColor,
            iconName: config.iconName,
            tooltip: config.tooltip,
            tooltipI18nParams: config.tooltipI18nParams,
        } as State
    }

}
