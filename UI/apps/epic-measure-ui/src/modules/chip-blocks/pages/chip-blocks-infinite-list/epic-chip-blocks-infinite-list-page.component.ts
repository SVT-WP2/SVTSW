import { AsyncPipe } from '@angular/common'
import { Component, computed, inject, OnDestroy, signal, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatTooltip } from '@angular/material/tooltip'
import {
    EpicButtonModule,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
    EpicIconComponent,
    EpicLoaderComponent,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicChipBlocksListContainerComponent,
    EpicChipBlocksListFilterComponent,
    EpicChipBlocksListFilterData,
    EpicChipBlocksListFilterDataSource,
    EpicChipBlocksListFilterValue,
    EpicChipBlocksScrollingDsFilter,
    getDefaultEpicChipBlocksListFilterValue,
} from 'epic-ui/shared/chip-blocks'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { Observable } from 'rxjs'


@Component({
    selector: 'epic-chip-blocks-infinite-list-page',
    templateUrl: 'epic-chip-blocks-infinite-list-page.component.html',
    imports: [
        FormsModule,
        AsyncPipe,
        MatTooltip,

        EpicLayoutLightModule,
        EpicButtonModule,
        EpicIconComponent,
        EpicContentErrorModule,
        EpicContentErrorMessagePipe,
        EpicLoaderComponent,
        EpicChipBlocksListFilterComponent,
        EpicChipBlocksListContainerComponent,
    ],
})
export class EpicChipBlocksInfiniteListPageComponent extends BaseComponent implements OnDestroy {

    readonly epicChipBlocksListContainerComponent = viewChild(EpicChipBlocksListContainerComponent)
    readonly headerFilterValue = signal<EpicChipBlocksListFilterValue>(getDefaultEpicChipBlocksListFilterValue())

    readonly dsFilterValue = computed<EpicChipBlocksScrollingDsFilter>(() => {
        const headerFilterValue = this.headerFilterValue()
        return {
            chipId: null,
            chipBlockTypes: headerFilterValue?.chipBlockType ? [headerFilterValue.chipBlockType] : null,
            serialNumber: headerFilterValue?.searchTerm?.length ? headerFilterValue.searchTerm : null,
        }
    })

    readonly fetchFilterDataProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly filterData$: Observable<EpicChipBlocksListFilterData>

    // DI
    protected readonly epicChipBlocksListFilterDataSource = inject(EpicChipBlocksListFilterDataSource)

    constructor() {
        super()
        this.fetchFilterDataProcessing$ = this.epicChipBlocksListFilterDataSource.loadingProcessing$
        this.filterData$ = this.epicChipBlocksListFilterDataSource.data$
        this.epicChipBlocksListFilterDataSource.load(true)
    }

    onReload(): void {
        this.epicChipBlocksListFilterDataSource.load(true)
        this.epicChipBlocksListContainerComponent().reload()
    }

}
