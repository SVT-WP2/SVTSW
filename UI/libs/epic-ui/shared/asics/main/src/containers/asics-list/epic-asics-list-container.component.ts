import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { ChangeDetectionStrategy, Component, effect, inject, input, OnDestroy, Signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatCardModule } from '@angular/material/card'
import { MatRipple } from '@angular/material/core'
import { MatTooltip } from '@angular/material/tooltip'
import { RouterLink } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicAsic } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicIconMatOutlinedPipe,
    EpicIconTileComponent,
    EpicInfiniteScrollContentComponent,
    EpicLoaderComponent,
    EpicScrollingDataSourceInfiniteScrollContentDirective,
    EpicScrollingDataSourceVirtualScrollViewportDirective,
    EpicContentErrorModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import { EpicAsicsScrollingDataSource, EpicAsicsScrollingDsFilter } from '../../services'


@Component({
    selector: 'epic-asics-list-container',
    templateUrl: 'epic-asics-list-container.component.html',
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
        MatRipple,
        FormsModule,
        RouterLink,
    ],
    host: {
        class: 'd-flex h-100 w-100',
    },
})
export class EpicAsicsListContainerComponent extends BaseComponent implements OnDestroy {

    readonly filterValue = input.required<Partial<EpicAsicsScrollingDsFilter>>()
    readonly showWaferInfo = input<boolean>(true)

    readonly asicsList: Signal<EpicAsic[] | undefined>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState | undefined>

    // DI
    readonly scrollingDataSource = inject(EpicAsicsScrollingDataSource)

    constructor() {
        super()

        this.asicsList = this.scrollingDataSource.dataRecords
        this.dataFetchingProcessing = this.scrollingDataSource.fetchDataProcessing
        this.scrollingDataSource.connect()

        effect(() => {
            const headerFilterValue = this.filterValue()
            if (headerFilterValue) {
                const dsFilter: EpicAsicsScrollingDsFilter = {
                    waferId: headerFilterValue?.waferId || null,
                    asicFamilyType: headerFilterValue?.asicFamilyType || null,
                    asicQuality: headerFilterValue?.asicQuality || null,
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
