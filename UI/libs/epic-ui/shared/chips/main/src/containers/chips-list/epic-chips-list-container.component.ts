import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { ChangeDetectionStrategy, Component, effect, inject, input, OnDestroy, Signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatCardModule } from '@angular/material/card'
import { MatTooltip } from '@angular/material/tooltip'
import { RouterLink } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicChip } from 'epic-ui/api'
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
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import { EpicChipsScrollingDataSource, EpicChipsScrollingDsFilter } from '../../services'


@Component({
    selector: 'epic-chips-list-container',
    templateUrl: 'epic-chips-list-container.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicButtonModule,
        EpicIconComponent,
        EpicScrollingDataSourceVirtualScrollViewportDirective,
        EpicScrollingDataSourceInfiniteScrollContentDirective,
        EpicInfiniteScrollContentComponent,
        CdkVirtualScrollViewport,
        CdkFixedSizeVirtualScroll,
        CdkVirtualForOf,
        EpicLoaderComponent,
        EpicContentErrorModule,
        MatCardModule,
        EpicIconMatOutlinedPipe,
        TranslatePipe,
        EpicIconTileComponent,
        FormsModule,
        RouterLink,
    ],
    host: {
        class: 'd-flex h-100 w-100',
    },
})
export class EpicChipsListContainerComponent extends BaseComponent implements OnDestroy {

    readonly filterValue = input.required<Partial<EpicChipsScrollingDsFilter>>()
    readonly showWaferInfo = input<boolean>(true)

    readonly chipsList: Signal<EpicChip[] | undefined>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState | undefined>

    // DI
    readonly scrollingDataSource = inject(EpicChipsScrollingDataSource)

    constructor() {
        super()

        this.chipsList = this.scrollingDataSource.dataRecords
        this.dataFetchingProcessing = this.scrollingDataSource.fetchDataProcessing
        this.scrollingDataSource.connect()

        effect(() => {
            const headerFilterValue = this.filterValue()
            if (headerFilterValue) {
                const dsFilter: EpicChipsScrollingDsFilter = {
                    familyTypes: headerFilterValue?.familyTypes?.length ? headerFilterValue.familyTypes : null,
                    generalLocation: headerFilterValue?.generalLocation || null,
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
