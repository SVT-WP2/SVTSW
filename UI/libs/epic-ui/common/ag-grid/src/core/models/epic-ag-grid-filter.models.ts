import {
    IDateFilterParams,
    IFilterDef,
    ISetFilterParams,
    ITextFilterParams,
    NumberFilterParams,
    SetFilterValuesFuncParams,
} from 'ag-grid-community'
import moment, { MomentInput } from 'moment'


export namespace EpicAgGridFilter {

    export enum CommonFilterType {
        Text = 'agTextColumnFilter',
        Number = 'agNumberColumnFilter',
        Set = 'agSetColumnFilter',
        Date = 'agDateColumnFilter',
        Multi = 'agMultiColumnFilter',
    }

    export type FilterValues = string[] | boolean[] | number[] | ((params: SetFilterValuesFuncParams) => void)

    export enum DefaultFilterName {
        text = 'text',
        number = 'number',
        set = 'set',
        date = 'date',
    }

    export enum NumberFilterType {
        equals = 'equals',
        notEqual = 'notEqual',
        greaterThan = 'greaterThan',
        greaterThanOrEqual = 'greaterThanOrEqual',
        lessThan = 'lessThan',
        lessThanOrEqual = 'lessThanOrEqual',
        inRange = 'inRange',
        blank = 'blank',
        notBlank = 'notBlank',
    }

    export enum TextFilterType {
        equals = 'equals',
        notEqual = 'notEqual',
        contains = 'contains',
        notContains = 'notContains',
        startsWith = 'startsWith',
        endsWith = 'endsWith',
        blank = 'blank',
        notBlank = 'notBlank',
    }

    export enum DateFilterType {
        equals = 'equals',
        notEqual = 'notEqual',
        greaterThan = 'greaterThan',
        greaterThanOrEqual = 'greaterThanOrEqual',
        lessThan = 'lessThan',
        lessThanOrEqual = 'lessThanOrEqual',
        inRange = 'inRange',
        blank = 'blank',
        notBlank = 'notBlank',
    }

    export const DATE_FILTER_DATE_FORMAT = 'yyyy-MM-DD HH:mm:ss'

    export function getCommonTextFilter(): IFilterDef {
        return {
            filter: CommonFilterType.Text,
            filterParams: {
                filterOptions: Object.values(TextFilterType),
                defaultOption: TextFilterType.contains,
                maxNumConditions: 1,
            } as ITextFilterParams,
        }
    }

    export function getCommonTextMultiFilter(): IFilterDef {
        const defaultFilter = getCommonTextFilter()
        return {
            ...defaultFilter,
            filterParams: {
                ...defaultFilter.filterParams,
                maxNumConditions: 2,
            } as ITextFilterParams,
        }
    }

    export function getCommonNumberFilter(): IFilterDef {
        return {
            filter: CommonFilterType.Number,
            filterParams: {
                filterOptions: Object.values(NumberFilterType),
                defaultOption: NumberFilterType.equals,
                maxNumConditions: 1,
            } as NumberFilterParams,
        }
    }

    export function getCommonNumberMultiFilter(): IFilterDef {
        const defaultFilter = getCommonNumberFilter()
        return {
            ...defaultFilter,
            filterParams: {
                ...defaultFilter.filterParams,
                maxNumConditions: 2,
            } as NumberFilterParams,
        }
    }

    export function getCommonSetFilter(): IFilterDef {
        return {
            filter: CommonFilterType.Set,
        }
    }

    export function getCommonValuesSetFilter(values: FilterValues, extraParams: Record<string, any> = {}): IFilterDef {
        return {
            ...getCommonSetFilter(),
            filterParams: {
                values,
                ...extraParams,
            },
        }
    }

    export function getCommonDateFilter(): IFilterDef {
        return {
            filter: CommonFilterType.Date,
            filterParams: {
                comparator: (filterLocalDateAtMidnight, cellValue) => {
                    const cellDate = moment(cellValue as MomentInput)

                    if (cellDate.isValid()) {
                        const startDay = cellDate.startOf('day')

                        if (startDay.isBefore(filterLocalDateAtMidnight)) {
                            return -1
                        }
                        else if (startDay.isAfter(filterLocalDateAtMidnight)) {
                            return 1
                        }
                        else {
                            return 0
                        }
                    }

                    return 0
                },
                maxNumConditions: 1,
            } as IDateFilterParams,
        }
    }

    export function getCommonMultiFilter(filters: IFilterDef[]): IFilterDef {
        return {
            filter: CommonFilterType.Multi,
            filterParams: {
                filters,
            },
        }
    }

    export function getCommonBooleanFilter(): IFilterDef {
        return {
            ...getCommonValuesSetFilter(
                [true, false],
                {
                    valueFormatter: (params) => params.value ? 'Yes' : 'No',
                    defaultToNothingSelected: true,
                } as ISetFilterParams,
            ),

        }
    }

}
