import { SystemColorName } from './system-color-name.models'
import { ISystemColors } from './system-colors.models'


export class SystemColorsBlue implements ISystemColors {

    readonly NEUTRAL_0: string = '#ffffff'
    readonly NEUTRAL_10: string = '#FAFAFB'
    readonly NEUTRAL_20: string = '#F5F6F6'
    readonly NEUTRAL_30: string = '#EBECED'
    readonly NEUTRAL_40: string = '#DEE1E2'
    readonly NEUTRAL_50: string = '#BFC5C8'
    readonly NEUTRAL_60: string = '#B0B6BB'
    readonly NEUTRAL_90: string = '#858F95'
    readonly NEUTRAL_300: string = '#57656E'
    readonly NEUTRAL_900: string = '#020B11'

    readonly PRIMARY_50: string = '#E6F1F8'
    readonly PRIMARY_100: string = '#2B8AC7'
    readonly PRIMARY_300: string = '#0072BC'
    readonly PRIMARY_400: string = '#005084'

    readonly SUCCESS_50: string = '#EBF8E9'
    readonly SUCCESS_100: string = '#5BC84B'
    readonly SUCCESS_300: string = '#3ABD26'
    readonly SUCCESS_400: string = '#29841B'

    readonly WARNING_50: string = '#FEF2E6'
    readonly WARNING_100: string = '#F39132'
    readonly WARNING_300: string = '#F07B08'
    readonly WARNING_400: string = '#A85606'

    readonly ERROR_50: string = '#FCEAEA'
    readonly ERROR_100: string = '#E95252'
    readonly ERROR_300: string = '#E52E2E'
    readonly ERROR_400: string = '#A02020'

    readonly INFO_50: string = '#E7F5FF'
    readonly INFO_100: string = '#71C7FF'
    readonly INFO_300: string = '#0A9EFF'
    readonly INFO_400: string = '#076FB3'

    readonly QUALITATIVE_1: string = '#33adff'
    readonly QUALITATIVE_2: string = '#d91a77'
    readonly QUALITATIVE_3: string = '#ff9400'
    readonly QUALITATIVE_4: string = '#2a29cc'
    readonly QUALITATIVE_5: string = '#fd3'
    readonly QUALITATIVE_6: string = '#9f29cb'
    readonly QUALITATIVE_7: string = '#e5332f'
    readonly QUALITATIVE_8: string = '#29cb37'
    readonly QUALITATIVE_9: string = '#cb6707'
    readonly QUALITATIVE_10: string = '#b0b6bb'

    readonly QUALITATIVE_PAIRED_1: string = '#c2e6ff'
    readonly QUALITATIVE_PAIRED_2: string = '#33adff'
    readonly QUALITATIVE_PAIRED_3: string = '#f4bad6'
    readonly QUALITATIVE_PAIRED_4: string = '#d91a77'
    readonly QUALITATIVE_PAIRED_5: string = '#ffdfb2'
    readonly QUALITATIVE_PAIRED_6: string = '#ff9400'
    readonly QUALITATIVE_PAIRED_7: string = '#bfbff0'
    readonly QUALITATIVE_PAIRED_8: string = '#2a29cc'
    readonly QUALITATIVE_PAIRED_9: string = '#fff5c2'
    readonly QUALITATIVE_PAIRED_10: string = '#fd3'
    readonly QUALITATIVE_PAIRED_11: string = '#e2bfef'
    readonly QUALITATIVE_PAIRED_12: string = '#9f29cb'
    readonly QUALITATIVE_PAIRED_13: string = '#f7c2c1'
    readonly QUALITATIVE_PAIRED_14: string = '#e5332f'
    readonly QUALITATIVE_PAIRED_15: string = '#bfefc3'
    readonly QUALITATIVE_PAIRED_16: string = '#29cb37'
    readonly QUALITATIVE_PAIRED_17: string = '#efd1b5'
    readonly QUALITATIVE_PAIRED_18: string = '#cb6707'
    readonly QUALITATIVE_PAIRED_19: string = '#dedede'
    readonly QUALITATIVE_PAIRED_20: string = '#b0b6bb'

    readonly SEQUENTIAL_1: string = '#0A9EFF'
    readonly SEQUENTIAL_2: string = '#43A7FF'
    readonly SEQUENTIAL_3: string = '#5FAFFF'
    readonly SEQUENTIAL_4: string = '#75B8FF'
    readonly SEQUENTIAL_5: string = '#89C1FF'
    readonly SEQUENTIAL_6: string = '#9BCAFF'
    readonly SEQUENTIAL_7: string = '#ADD2FF'
    readonly SEQUENTIAL_8: string = '#BEDBFF'
    readonly SEQUENTIAL_9: string = '#CEE4FF'
    readonly SEQUENTIAL_10: string = '#DEEDFF'
    readonly SEQUENTIAL_11: string = '#F5F6F6'
    readonly DIVERGING_1: string = '#3ABD26'
    readonly DIVERGING_2: string = '#6CC855'
    readonly DIVERGING_3: string = '#91D37D'
    readonly DIVERGING_4: string = '#B3DDA3'
    readonly DIVERGING_5: string = '#D2E7CA'
    readonly DIVERGING_6: string = '#F5F6F6'
    readonly DIVERGING_7: string = '#F8CEC7'
    readonly DIVERGING_8: string = '#F9AB9E'
    readonly DIVERGING_9: string = '#F68777'
    readonly DIVERGING_10: string = '#EF6052'
    readonly DIVERGING_11: string = '#E52E2E'

    readonly qualitativeColors: ReadonlyArray<string> = [
        this.QUALITATIVE_1,
        this.QUALITATIVE_2,
        this.QUALITATIVE_3,
        this.QUALITATIVE_4,
        this.QUALITATIVE_5,
        this.QUALITATIVE_6,
        this.QUALITATIVE_7,
        this.QUALITATIVE_8,
        this.QUALITATIVE_9,
        this.QUALITATIVE_10,
    ]

    readonly qualitativePairedColors: ReadonlyArray<string> = [
        this.QUALITATIVE_PAIRED_1,
        this.QUALITATIVE_PAIRED_2,
        this.QUALITATIVE_PAIRED_3,
        this.QUALITATIVE_PAIRED_4,
        this.QUALITATIVE_PAIRED_5,
        this.QUALITATIVE_PAIRED_6,
        this.QUALITATIVE_PAIRED_7,
        this.QUALITATIVE_PAIRED_8,
        this.QUALITATIVE_PAIRED_9,
        this.QUALITATIVE_PAIRED_10,
        this.QUALITATIVE_PAIRED_11,
        this.QUALITATIVE_PAIRED_12,
        this.QUALITATIVE_PAIRED_13,
        this.QUALITATIVE_PAIRED_14,
        this.QUALITATIVE_PAIRED_15,
        this.QUALITATIVE_PAIRED_16,
        this.QUALITATIVE_PAIRED_17,
        this.QUALITATIVE_PAIRED_18,
        this.QUALITATIVE_PAIRED_19,
        this.QUALITATIVE_PAIRED_20,
    ]

    readonly sequentialColors: ReadonlyArray<string> = [
        this.SEQUENTIAL_1,
        this.SEQUENTIAL_2,
        this.SEQUENTIAL_3,
        this.SEQUENTIAL_4,
        this.SEQUENTIAL_5,
        this.SEQUENTIAL_6,
        this.SEQUENTIAL_7,
        this.SEQUENTIAL_8,
        this.SEQUENTIAL_9,
        this.SEQUENTIAL_10,
        this.SEQUENTIAL_11,
    ]

    readonly divergingColors: ReadonlyArray<string> = [
        this.DIVERGING_1,
        this.DIVERGING_2,
        this.DIVERGING_3,
        this.DIVERGING_4,
        this.DIVERGING_5,
        this.DIVERGING_6,
        this.DIVERGING_7,
        this.DIVERGING_8,
        this.DIVERGING_9,
        this.DIVERGING_10,
        this.DIVERGING_11,
    ]

    getColorByName(systemColorName: SystemColorName): string | undefined {
        return this[systemColorName]
    }

}
