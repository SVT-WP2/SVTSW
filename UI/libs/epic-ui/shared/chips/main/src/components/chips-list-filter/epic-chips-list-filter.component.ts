import { Component, computed, input, model, OnDestroy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatCardModule } from '@angular/material/card'
import { MatDivider } from '@angular/material/divider'
import { MatTooltip } from '@angular/material/tooltip'
import { TranslatePipe } from '@ngx-translate/core'
import {
    EpicButtonModule,
    EpicIconComponent, EpicIconMatOutlinedPipe,
    EpicInlineFilterSelectionListComponent,
    EpicContentErrorModule,
    EpicSearchBoxComponent,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { BaseComponent, SelectOptionLabelValue } from 'epic-ui/utils'


export type EpicChipsListFilterValue = {
    searchTerm: string
    familyType: string | null
    generalLocation: string | null
}

export type EpicChipsListFilterData = {
    familyTypeSelectOptions: SelectOptionLabelValue[]
    generalLocationSelectOptions: SelectOptionLabelValue[]
}

export function getDefaultEpicChipsListFilterValue(): EpicChipsListFilterValue {
    return {
        searchTerm: '',
        familyType: null,
        generalLocation: null,
    }
}

export function isEpicChipsListFilterValueEmpty(filterValue: EpicChipsListFilterValue): boolean {
    return Object.values(filterValue).every(value => value === null || value === '')
}

@Component({
    selector: 'epic-chips-list-filter',
    templateUrl: 'epic-chips-list-filter.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicButtonModule,
        EpicIconComponent,
        EpicContentErrorModule,
        MatCardModule,
        TranslatePipe,
        EpicInlineFilterSelectionListComponent,
        EpicSearchBoxComponent,
        MatDivider,
        FormsModule,
        EpicIconMatOutlinedPipe,
    ],
})
export class EpicChipsListFilterComponent extends BaseComponent implements OnDestroy {

    readonly filterValue = model<EpicChipsListFilterValue>(getDefaultEpicChipsListFilterValue())
    readonly filterData = input<EpicChipsListFilterData>()

    readonly isFilterValueEmpty = computed<boolean>(() => isEpicChipsListFilterValueEmpty(this.filterValue()))

    onFilterChange(key: keyof EpicChipsListFilterValue, value: any): any {
        this.filterValue.set({
            ...this.filterValue(),
            [key]: value,
        })
    }

    onClearFilter(): void {
        this.filterValue.set(getDefaultEpicChipsListFilterValue())
    }

}
