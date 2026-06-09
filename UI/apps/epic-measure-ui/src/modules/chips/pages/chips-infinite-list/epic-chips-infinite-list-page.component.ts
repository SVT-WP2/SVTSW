import { AsyncPipe } from '@angular/common'
import { Component, computed, inject, OnDestroy, signal, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatCardModule } from '@angular/material/card'
import { MatTooltip } from '@angular/material/tooltip'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicLoaderComponent, EpicContentErrorMessagePipe,
    EpicContentErrorModule,
    EpicSearchBoxModule,
    EpicSelectModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicChipsListContainerComponent,
    EpicChipsListFilterComponent,
    EpicChipsListFilterData,
    EpicChipsListFilterDataSource,
    EpicChipsListFilterValue,
    EpicChipsScrollingDsFilter,
    getDefaultEpicChipsListFilterValue,
} from 'epic-ui/shared/chips'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { Observable } from 'rxjs'


@Component({
    selector: 'epic-chips-infinite-list-page',
    templateUrl: 'epic-chips-infinite-list-page.component.html',
    imports: [
        FormsModule,
        AsyncPipe,
        MatTooltip,
        MatCardModule,

        EpicLayoutLightModule,
        EpicButtonModule,
        EpicIconComponent,
        EpicContentErrorModule,
        EpicSelectModule,
        EpicSearchBoxModule,
        EpicLoaderComponent,
        EpicChipsListFilterComponent,
        EpicChipsListContainerComponent,
        EpicContentErrorMessagePipe,
    ],
})
export class EpicChipsInfiniteListPageComponent extends BaseComponent implements OnDestroy {

    readonly epicChipsListContainerComponent = viewChild(EpicChipsListContainerComponent)
    readonly headerFilterValue = signal<EpicChipsListFilterValue>(getDefaultEpicChipsListFilterValue())

    readonly dsFilterValue = computed<EpicChipsScrollingDsFilter>(() => {
        const headerFilterValue = this.headerFilterValue()
        return {
            generalLocation: headerFilterValue?.generalLocation || null,
            serialNumber: headerFilterValue?.searchTerm?.length ? headerFilterValue.searchTerm : null,
        }
    })

    readonly fetchFilterDataProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly filterData$: Observable<EpicChipsListFilterData>

    // DI
    protected readonly epicChipsListFilterDataSource = inject(EpicChipsListFilterDataSource)

    constructor() {
        super()
        this.fetchFilterDataProcessing$ = this.epicChipsListFilterDataSource.loadingProcessing$
        this.filterData$ = this.epicChipsListFilterDataSource.data$
        this.epicChipsListFilterDataSource.load(true)
    }

    onReload(): void {
        this.epicChipsListFilterDataSource.load(true)
        this.epicChipsListContainerComponent().reload()
    }

}
