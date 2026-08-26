import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { ChangeDetectionStrategy, Component, effect, inject, input, OnDestroy, Signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatCardModule } from '@angular/material/card'
import { MatTooltip } from '@angular/material/tooltip'
import { RouterLink } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicChipBlock } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicContentErrorModule,
    EpicIconComponent,
    EpicIconMatOutlinedPipe,
    EpicIconTileComponent,
    EpicInfiniteScrollContentComponent,
    EpicLoaderComponent,
    EpicScrollingDataSourceInfiniteScrollContentDirective,
    EpicScrollingDataSourceVirtualScrollViewportDirective,
} from 'epic-ui/common/components'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import { EpicChipBlocksScrollingDataSource, EpicChipBlocksScrollingDsFilter } from '../../services'


@Component({
    selector: 'epic-chip-blocks-list-container',
    templateUrl: 'epic-chip-blocks-list-container.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatTooltip,
        MatCardModule,
        FormsModule,
        RouterLink,
        TranslatePipe,
        CdkVirtualScrollViewport,
        CdkFixedSizeVirtualScroll,
        CdkVirtualForOf,
        EpicButtonModule,
        EpicIconComponent,
        EpicIconMatOutlinedPipe,
        EpicIconTileComponent,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicInfiniteScrollContentComponent,
        EpicScrollingDataSourceVirtualScrollViewportDirective,
        EpicScrollingDataSourceInfiniteScrollContentDirective,
    ],
    host: {
        class: 'd-flex h-100 w-100',
    },
})
export class EpicChipBlocksListContainerComponent extends BaseComponent implements OnDestroy {

    readonly filterValue = input.required<Partial<EpicChipBlocksScrollingDsFilter>>()

    readonly chipBlocksList: Signal<EpicChipBlock[] | undefined>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState | undefined>

    // DI
    readonly scrollingDataSource = inject(EpicChipBlocksScrollingDataSource)

    constructor() {
        super()

        this.chipBlocksList = this.scrollingDataSource.dataRecords
        this.dataFetchingProcessing = this.scrollingDataSource.fetchDataProcessing
        this.scrollingDataSource.connect()

        effect(() => {
            const headerFilterValue = this.filterValue()
            if (headerFilterValue) {
                const dsFilter: EpicChipBlocksScrollingDsFilter = {
                    chipId: headerFilterValue?.chipId || null,
                    chipBlockTypes: headerFilterValue?.chipBlockTypes?.length ? headerFilterValue.chipBlockTypes : null,
                    serialNumber: headerFilterValue?.serialNumber?.length ? headerFilterValue.serialNumber : null,
                }
                this.scrollingDataSource.actionFetchData({ filter: dsFilter })
            }
        })
    }

    reload(): void {
        this.scrollingDataSource.actionFetchData()
    }

    override ngOnDestroy(): void {
        super.ngOnDestroy()
        this.scrollingDataSource.disconnect()
        this.scrollingDataSource.resetState()
    }

}
