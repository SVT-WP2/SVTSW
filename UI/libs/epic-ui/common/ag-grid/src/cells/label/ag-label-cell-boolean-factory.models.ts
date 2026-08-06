import { ColDef, ValueFormatterParams } from 'ag-grid-community'
import { EpicRecord } from 'epic-ui/utils'
import { DEFAULT_SYSTEM_COLORS, ISystemColors } from 'epic-ui/utils/colors'
import { isNil } from 'lodash-es'

import { AgLabelCellFactory } from './ag-label-cell-factory.models'


export namespace AgLabelCellBooleanFactory {

    export type LabelConfig = {
        label?: string
        color?: string
        bgColor?: string
    }

    export type LabelConfigGetterFn = (value: boolean) => LabelConfig

    export type Config = {
        labelConfigGetter?: LabelConfigGetterFn
        systemColors?: ISystemColors
    }

    export function getDefaultLabelConfigGetter(systemColors?: ISystemColors): LabelConfigGetterFn {
        return (value) => {
            return value
                ? {
                    label: 'COMMON.YES',
                    color: (systemColors || DEFAULT_SYSTEM_COLORS).SUCCESS_400,
                    bgColor: (systemColors || DEFAULT_SYSTEM_COLORS).SUCCESS_50,
                }
                : {
                    label: 'COMMON.NO',
                    color: (systemColors || DEFAULT_SYSTEM_COLORS).ERROR_400,
                    bgColor: (systemColors || DEFAULT_SYSTEM_COLORS).ERROR_50,
                }
        }
    }

    export function getDefaultConfig(systemColors?: ISystemColors): Config {
        return {
            labelConfigGetter: getDefaultLabelConfigGetter(systemColors),
        }
    }

    export function createCellSchema<TRowData = EpicRecord>(config?: Partial<Config>): ColDef {
        return {
            ...AgLabelCellFactory.createCellSchema<TRowData, boolean>({
                config: (args) => {
                    const resultConfig = { ...getDefaultConfig(config?.systemColors), ...(config || {}) } as Config
                    const labelConfig = resultConfig.labelConfigGetter?.(args.params.value)

                    return {
                        color: labelConfig?.color,
                        bgColor: labelConfig?.bgColor,
                    }
                },
            }),
            valueFormatter: ({ value }: ValueFormatterParams<TRowData, boolean>): string => {
                const resultConfig = { ...getDefaultConfig(config?.systemColors), ...(config || {}) } as Config
                const labelConfig = !isNil(value) ? resultConfig.labelConfigGetter?.(value) : null

                return labelConfig?.label || ''
            },
        }
    }

}
