import { AsyncPipe } from '@angular/common'
import { Component, computed, inject, OnDestroy, signal, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatCardModule } from '@angular/material/card'
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu'
import { MatTooltip } from '@angular/material/tooltip'
import {
    EpicButtonModule,
    EpicExpandIconDirective,
    EpicIconComponent,
    EpicIconMatOutlinedPipe,
    EpicLoaderComponent,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
    EpicSearchBoxModule,
    EpicSelectModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicAsicCreateDialogService,
    EpicAsicsListContainerComponent,
    EpicAsicsListFilterComponent,
    EpicAsicsListFilterData,
    EpicAsicsListFilterDataSource,
    EpicAsicsListFilterValue,
    EpicAsicsScrollingDsFilter,
    getDefaultEpicAsicsListFilterValue,
} from 'epic-ui/shared/asics'
import { EpicChipCreateWithFileDialogService } from 'epic-ui/shared/chips'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { Observable } from 'rxjs'


@Component({
    selector: 'epic-asics-infinite-list-page',
    templateUrl: 'epic-asics-infinite-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicButtonModule,
        EpicIconComponent,
        EpicContentErrorModule,
        MatCardModule,
        EpicAsicsListContainerComponent,
        EpicSelectModule,
        EpicSearchBoxModule,
        FormsModule,
        AsyncPipe,
        EpicAsicsListFilterComponent,
        EpicLoaderComponent,
        EpicContentErrorMessagePipe,
        EpicIconMatOutlinedPipe,
        MatMenu,
        MatMenuItem,
        MatMenuTrigger,
        EpicExpandIconDirective,
    ],
})
export class EpicAsicsInfiniteListPageComponent extends BaseComponent implements OnDestroy {

    readonly epicAsicsListContainerComponent = viewChild(EpicAsicsListContainerComponent)
    readonly headerFilterValue = signal<EpicAsicsListFilterValue>(getDefaultEpicAsicsListFilterValue())

    readonly dsFilterValue = computed<EpicAsicsScrollingDsFilter>(() => {
        const headerFilterValue = this.headerFilterValue()
        return {
            waferId: headerFilterValue?.waferId || null,
            asicFamilyTypes: headerFilterValue?.asicFamilyType ? [headerFilterValue?.asicFamilyType] : null,
            asicQuality: headerFilterValue?.asicQuality || null,
            serialNumber: headerFilterValue?.searchTerm?.length ? headerFilterValue.searchTerm : null,
        } satisfies EpicAsicsScrollingDsFilter
    })

    readonly fetchFilterDataProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly filterData$: Observable<EpicAsicsListFilterData>

    // DI
    protected readonly epicAsicCreateDialogService = inject(EpicAsicCreateDialogService)
    protected readonly epicAsicsListFilterDataSource = inject(EpicAsicsListFilterDataSource)
    protected readonly epicChipCreateWithFileDialogService = inject(EpicChipCreateWithFileDialogService)

    constructor() {
        super()
        this.fetchFilterDataProcessing$ = this.epicAsicsListFilterDataSource.loadingProcessing$
        this.filterData$ = this.epicAsicsListFilterDataSource.data$
        this.epicAsicsListFilterDataSource.load(true)
    }

    onReload(): void {
        this.epicAsicsListFilterDataSource.load(true)
        this.epicAsicsListContainerComponent()?.reload()
    }

    onCreateAsic(): void {
        this.epicAsicCreateDialogService.openDialog({
            onSuccess: () => {
                this.onReload()
            },
        })
    }

    onCreateChip(): void {
        this.epicChipCreateWithFileDialogService.openDialog({
            onSuccess: (chips) => this.onReload(),
        })
    }

}
