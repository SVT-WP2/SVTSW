import { EpicWafer } from 'epic-ui/api'
import { SelectOptionLabelValue } from 'epic-ui/utils'


export type EpicAsicsListFilterValue = {
    searchTerm: string
    asicFamilyType: string | null
    asicQuality: string | null
    waferId: number | null
}

export type EpicAsicsListFilterData = {
    asicFamilyTypeSelectOptions: SelectOptionLabelValue[]
    asicQualitySelectOptions: SelectOptionLabelValue[]
    waferSelectOptions: SelectOptionLabelValue<number, EpicWafer>[]
}

export function getDefaultEpicAsicsListFilterValue(): EpicAsicsListFilterValue {
    return {
        searchTerm: '',
        asicFamilyType: null,
        asicQuality: null,
        waferId: null,
    }
}

export function isEpicAsicsListFilterValueEmpty(filterValue: EpicAsicsListFilterValue): boolean {
    return Object.values(filterValue).every(value => value === null || value === '')
}
