import { InjectionToken } from '@angular/core'

import { SystemColorName } from './system-color-name.models'


export interface ISystemColors<TSystemColorName extends SystemColorName = SystemColorName> {

    readonly NEUTRAL_0: string
    readonly NEUTRAL_10: string
    readonly NEUTRAL_20: string
    readonly NEUTRAL_30: string
    readonly NEUTRAL_40: string
    readonly NEUTRAL_50: string
    readonly NEUTRAL_60: string
    readonly NEUTRAL_90: string
    readonly NEUTRAL_300: string
    readonly NEUTRAL_900: string

    readonly PRIMARY_50: string
    readonly PRIMARY_100: string
    readonly PRIMARY_300: string
    readonly PRIMARY_400: string

    readonly SUCCESS_50: string
    readonly SUCCESS_100: string
    readonly SUCCESS_300: string
    readonly SUCCESS_400: string

    readonly WARNING_50: string
    readonly WARNING_100: string
    readonly WARNING_300: string
    readonly WARNING_400: string

    readonly ERROR_50: string
    readonly ERROR_100: string
    readonly ERROR_300: string
    readonly ERROR_400: string

    readonly INFO_50: string
    readonly INFO_100: string
    readonly INFO_300: string
    readonly INFO_400: string

    readonly qualitativeColors: ReadonlyArray<string>
    readonly qualitativePairedColors: ReadonlyArray<string>
    readonly sequentialColors: ReadonlyArray<string>
    readonly divergingColors: ReadonlyArray<string>

    getColorByName(systemColorName: TSystemColorName | string): string | undefined

}

export const SYSTEM_COLORS = new InjectionToken<ISystemColors>('SYSTEM_COLORS')
