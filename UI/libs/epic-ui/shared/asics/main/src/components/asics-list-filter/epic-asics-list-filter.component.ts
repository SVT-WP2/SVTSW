import { Component, computed, input, model, OnDestroy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatCardModule } from '@angular/material/card'
import { MatDivider } from '@angular/material/divider'
import { MatTooltip } from '@angular/material/tooltip'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicWafer } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicInlineFilterSelectionListComponent,
    EpicContentErrorModule,
    EpicSearchBoxComponent,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { BaseComponent } from 'epic-ui/utils'

import {
    EpicAsicsListFilterData,
    EpicAsicsListFilterValue,
    getDefaultEpicAsicsListFilterValue,
    isEpicAsicsListFilterValueEmpty,
} from '../../models'


@Component({
    selector: 'epic-asics-list-filter',
    templateUrl: 'epic-asics-list-filter.component.html',
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
    ],
})
export class EpicAsicsListFilterComponent extends BaseComponent implements OnDestroy {

    readonly filterValue = model<EpicAsicsListFilterValue>(getDefaultEpicAsicsListFilterValue())
    readonly filterData = input<EpicAsicsListFilterData>()
    readonly showWaferFilter = input<boolean>(true)

    readonly isFilterValueEmpty = computed<boolean>(() => isEpicAsicsListFilterValueEmpty(this.filterValue()))
    readonly selectedWafer = computed<EpicWafer | undefined>(() => {
        const waferSelectOptions = this.filterData()?.waferSelectOptions || []
        const selectedWaferId = this.filterValue().waferId
        return selectedWaferId
            ? waferSelectOptions
                .find(item => item.additionalData!.id === this.filterValue().waferId)
                ?.additionalData
            : undefined
    })


    onFilterChange(key: keyof EpicAsicsListFilterValue, value: any): any {
        this.filterValue.set({
            ...this.filterValue(),
            [key]: value,
        })
    }

    onClearFilter(): void {
        this.filterValue.set(getDefaultEpicAsicsListFilterValue())
    }

}
