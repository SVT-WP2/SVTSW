import { Component, computed, input, model, OnDestroy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatDivider } from '@angular/material/divider'
import { MatTooltip } from '@angular/material/tooltip'
import { TranslatePipe } from '@ngx-translate/core'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicIconMatOutlinedPipe,
    EpicInlineFilterSelectionListComponent,
    EpicSearchBoxComponent,
} from 'epic-ui/common/components'
import { BaseComponent, SelectOptionLabelValue } from 'epic-ui/utils'


export type EpicChipBlocksListFilterValue = {
    searchTerm: string
    chipBlockType: string | null
}

export type EpicChipBlocksListFilterData = {
    chipBlockTypeSelectOptions: SelectOptionLabelValue[]
}

export function getDefaultEpicChipBlocksListFilterValue(): EpicChipBlocksListFilterValue {
    return {
        searchTerm: '',
        chipBlockType: null,
    }
}

export function isEpicChipBlocksListFilterValueEmpty(filterValue: EpicChipBlocksListFilterValue): boolean {
    return Object.values(filterValue).every(value => value === null || value === '')
}

@Component({
    selector: 'epic-chip-blocks-list-filter',
    templateUrl: 'epic-chip-blocks-list-filter.component.html',
    imports: [
        MatTooltip,
        MatDivider,
        FormsModule,
        TranslatePipe,
        EpicButtonModule,
        EpicIconComponent,
        EpicIconMatOutlinedPipe,
        EpicInlineFilterSelectionListComponent,
        EpicSearchBoxComponent,
    ],
})
export class EpicChipBlocksListFilterComponent extends BaseComponent implements OnDestroy {

    readonly filterValue = model<EpicChipBlocksListFilterValue>(getDefaultEpicChipBlocksListFilterValue())
    readonly filterData = input<EpicChipBlocksListFilterData>()

    readonly isFilterValueEmpty = computed<boolean>(() => isEpicChipBlocksListFilterValueEmpty(this.filterValue()))

    onFilterChange(key: keyof EpicChipBlocksListFilterValue, value: any): any {
        this.filterValue.set({
            ...this.filterValue(),
            [key]: value,
        })
    }

    onClearFilter(): void {
        this.filterValue.set(getDefaultEpicChipBlocksListFilterValue())
    }

}
