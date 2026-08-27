import { Component, computed, input, model } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatDivider } from '@angular/material/divider'
import { MatTooltip } from '@angular/material/tooltip'
import { TranslatePipe } from '@ngx-translate/core'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicIconMatOutlinedPipe,
    EpicInlineFilterDateRange,
    EpicInlineFilterDateRangeComponent,
    EpicInlineFilterSelectionListComponent,
    EpicSearchBoxComponent,
} from 'epic-ui/common/components'
import { BaseComponent, SelectOptionLabelValue } from 'epic-ui/utils'

import {
    EpicSvtTestsListFilterData,
    EpicSvtTestsListFilterValue,
    getDefaultEpicSvtTestsListFilterValue,
    getEpicSvtTestConfigIdsOfTestSetups,
    getEpicSvtTestConfigIdsOfTestTypes,
    getEpicSvtTestDutEntityNameSelectOptions,
    getEpicSvtTestStatusSelectOptions,
    isEpicSvtTestsListFilterValueEmpty,
} from '../../models'


@Component({
    selector: 'epic-svt-tests-list-filter',
    templateUrl: 'epic-svt-tests-list-filter.component.html',
    imports: [
        FormsModule,
        MatDivider,
        MatTooltip,
        TranslatePipe,
        EpicButtonModule,
        EpicIconComponent,
        EpicIconMatOutlinedPipe,
        EpicInlineFilterDateRangeComponent,
        EpicInlineFilterSelectionListComponent,
        EpicSearchBoxComponent,
    ],
})
export class EpicSvtTestsListFilterComponent extends BaseComponent {

    readonly filterValue = model<EpicSvtTestsListFilterValue>(getDefaultEpicSvtTestsListFilterValue())
    readonly filterData = input<EpicSvtTestsListFilterData | null>()

    readonly dutEntityNameSelectOptions = getEpicSvtTestDutEntityNameSelectOptions()
    readonly statusSelectOptions = getEpicSvtTestStatusSelectOptions()

    readonly isFilterValueEmpty = computed<boolean>(() => isEpicSvtTestsListFilterValueEmpty(this.filterValue()))

    /** Only the configs of the selected test types are offered — with no test type selected, all of them are. */
    readonly testTypeConfigSelectOptions = computed<SelectOptionLabelValue<number>[]>(() => (
        toNarrowedSelectOptions(
            this.filterData()?.testTypeConfigSelectOptions,
            getEpicSvtTestConfigIdsOfTestTypes(this.filterValue().testTypeIds, this.filterData()),
        )
    ))

    /** The same for the configs of the selected test setups. */
    readonly testSetupConfigSelectOptions = computed<SelectOptionLabelValue<number>[]>(() => (
        toNarrowedSelectOptions(
            this.filterData()?.testSetupConfigSelectOptions,
            getEpicSvtTestConfigIdsOfTestSetups(this.filterValue().testSetupIds, this.filterData()),
        )
    ))

    onFilterChange(key: keyof EpicSvtTestsListFilterValue, value: any): void {
        this.filterValue.set({
            ...this.filterValue(),
            [key]: value,
        })
    }

    /**
     * Changing the test types drops the configs that no longer belong to any of them — left in place they would
     * keep narrowing the list down while their option is not even offered any more.
     */
    onTestTypeIdsChange(testTypeIds: number[] | null): void {
        this.filterValue.set({
            ...this.filterValue(),
            testTypeIds,
            testTypeConfigIds: toPrunedConfigIds(
                this.filterValue().testTypeConfigIds,
                getEpicSvtTestConfigIdsOfTestTypes(testTypeIds, this.filterData()),
            ),
        })
    }

    /** The same for the test setups and their configs. */
    onTestSetupIdsChange(testSetupIds: number[] | null): void {
        this.filterValue.set({
            ...this.filterValue(),
            testSetupIds,
            testSetupConfigIds: toPrunedConfigIds(
                this.filterValue().testSetupConfigIds,
                getEpicSvtTestConfigIdsOfTestSetups(testSetupIds, this.filterData()),
            ),
        })
    }

    onClearFilter(): void {
        this.filterValue.set(getDefaultEpicSvtTestsListFilterValue())
    }

    protected toDateRangeLabel(label: string, value: EpicInlineFilterDateRange.Value | null): string {
        const rangeLabel = EpicInlineFilterDateRange.toLabel(value)

        return rangeLabel ? `${label}: ${rangeLabel}` : label
    }

}

function toNarrowedSelectOptions(
    selectOptions: SelectOptionLabelValue<number>[] | undefined, allowedValues: number[] | null): SelectOptionLabelValue<number>[] {

    return allowedValues
        ? (selectOptions || []).filter(item => allowedValues.includes(item.value))
        : selectOptions || []
}

function toPrunedConfigIds(configIds: number[] | null, allowedConfigIds: number[] | null): number[] | null {
    const prunedConfigIds = allowedConfigIds
        ? (configIds || []).filter(item => allowedConfigIds.includes(item))
        : configIds

    return prunedConfigIds?.length ? prunedConfigIds : null
}
