import { Component, computed, input, model, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatDivider } from '@angular/material/divider'
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu'
import { MatTooltip } from '@angular/material/tooltip'
import { TranslatePipe } from '@ngx-translate/core'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicIconMatOutlinedPipe,
    EpicInlineFilterComponent,
    EpicInlineFilterDateRange,
    EpicInlineFilterDateRangeComponent,
    EpicInlineFilterSelectionListComponent,
    EpicSearchBoxComponent,
} from 'epic-ui/common/components'
import { BaseComponent, SelectOptionLabelValue } from 'epic-ui/utils'

import {
    EPIC_SVT_TESTS_LIST_OPTIONAL_FILTERS,
    EpicSvtTestsListFilterData,
    EpicSvtTestsListFilterValue,
    EpicSvtTestsListOptionalFilter,
    EpicSvtTestsListOptionalFilterKey,
    getDefaultEpicSvtTestsListFilterValue,
    getEpicSvtTestConfigIdsOfTestSetups,
    getEpicSvtTestConfigIdsOfTestTypes,
    getEpicSvtTestDutEntityNameSelectOptions,
    getEpicSvtTestStatusSelectOptions,
    isEpicSvtTestsListFilterValueEmpty,
    isEpicSvtTestsListOptionalFilterSet,
} from '../../models'


/**
 * The filter bar of a tests list. Only the filters most lists are narrowed down by are there from the start —
 * the rest is offered by the "More Filters" menu and joins the bar right of them, see `visibleOptionalFilters`.
 */
@Component({
    selector: 'epic-svt-tests-list-filter',
    templateUrl: 'epic-svt-tests-list-filter.component.html',
    imports: [
        FormsModule,
        MatDivider,
        MatMenu,
        MatMenuContent,
        MatMenuItem,
        MatMenuTrigger,
        MatTooltip,
        TranslatePipe,
        EpicButtonModule,
        EpicIconComponent,
        EpicIconMatOutlinedPipe,
        EpicInlineFilterComponent,
        EpicInlineFilterDateRangeComponent,
        EpicInlineFilterSelectionListComponent,
        EpicSearchBoxComponent,
    ],
})
export class EpicSvtTestsListFilterComponent extends BaseComponent {

    readonly filterValue = model<EpicSvtTestsListFilterValue>(getDefaultEpicSvtTestsListFilterValue())
    readonly filterData = input<EpicSvtTestsListFilterData | null>()
    /** A list that is one single DUT already answers the question this filter asks, so it hides it. */
    readonly showDutEntityNameFilter = input<boolean>(true)

    readonly dutEntityNameSelectOptions = getEpicSvtTestDutEntityNameSelectOptions()
    readonly statusSelectOptions = getEpicSvtTestStatusSelectOptions()

    /** The optional filters picked from the "More Filters" menu, in the order they were picked in. */
    readonly addedOptionalFilterKeys = signal<EpicSvtTestsListOptionalFilterKey[]>([])

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

    /**
     * Which optional filters the bar draws, in the order it draws them in: the ones that were added to it, in
     * the order they were picked, so a filter joins the bar where it was asked for — at its right end. Ahead
     * of them go the ones nobody picked but that already narrow the list down, since a filter value handed in
     * from outside must be visible rather than filter blindly.
     */
    readonly visibleOptionalFilters = computed<EpicSvtTestsListOptionalFilter[]>(() => {
        const addedKeys = this.addedOptionalFilterKeys()

        return EPIC_SVT_TESTS_LIST_OPTIONAL_FILTERS
            .filter(item => (
                this.isOptionalFilterOffered(item.key)
                && (addedKeys.includes(item.key) || isEpicSvtTestsListOptionalFilterSet(this.filterValue(), item.key))
            ))
            .sort((left, right) => addedKeys.indexOf(left.key) - addedKeys.indexOf(right.key))
    })

    /** What is left for the "More Filters" menu to offer — with nothing left the menu is not drawn at all. */
    readonly moreFilters = computed<EpicSvtTestsListOptionalFilter[]>(() => {
        const visibleKeys = this.visibleOptionalFilters().map(item => item.key)

        return EPIC_SVT_TESTS_LIST_OPTIONAL_FILTERS
            .filter(item => !visibleKeys.includes(item.key) && this.isOptionalFilterOffered(item.key))
    })

    /** An optional filter that was added but left empty is cleared away as well, so it can be taken back. */
    readonly canClearFilter = computed<boolean>(() => !this.isFilterValueEmpty() || !!this.addedOptionalFilterKeys().length)

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

    onShowOptionalFilter(key: EpicSvtTestsListOptionalFilterKey): void {
        this.addedOptionalFilterKeys.update(keys => [...keys, key])
    }

    /** Clearing takes the bar back to where it started — the values it holds and the filters it was given. */
    onClearFilter(): void {
        this.filterValue.set(getDefaultEpicSvtTestsListFilterValue())
        this.addedOptionalFilterKeys.set([])
    }

    protected toDateRangeLabel(label: string, value: EpicInlineFilterDateRange.Value | null): string {
        const rangeLabel = EpicInlineFilterDateRange.toLabel(value)

        return rangeLabel ? `${label}: ${rangeLabel}` : label
    }

    /** Neither config filter is offered before the options it would be picked from are in. */
    private isOptionalFilterOffered(key: EpicSvtTestsListOptionalFilterKey): boolean {
        switch (key) {
            case 'testTypeConfigIds':
            case 'testSetupConfigIds':
                return !!this.filterData()
            default:
                return true
        }
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
