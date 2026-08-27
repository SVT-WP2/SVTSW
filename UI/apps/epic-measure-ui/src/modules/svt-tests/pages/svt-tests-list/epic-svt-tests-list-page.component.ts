import { Component, effect, inject, OnDestroy, OnInit, signal, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { MatTooltip } from '@angular/material/tooltip'
import { IDatasource } from 'ag-grid-community'
import { EpicSvtTestTemplate } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
    EpicIconComponent,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicSvtTestCreateDialogService,
    EpicSvtTestsGridDataSource,
    EpicSvtTestsListComponent,
    EpicSvtTestsListFilterComponent,
    EpicSvtTestsListFilterData,
    EpicSvtTestsListFilterDataSource,
    EpicSvtTestsListFilterValue,
    getDefaultEpicSvtTestsListFilterValue,
    toEpicSvtTestsListQueryFilter,
} from 'epic-ui/shared/svt-test/tests'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'


@Component({
    selector: 'epic-svt-tests-list-page',
    templateUrl: 'epic-svt-tests-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicIconComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicContentErrorMessagePipe,
        EpicSvtTestsListComponent,
        EpicSvtTestsListFilterComponent,
    ],
})
export class EpicSvtTestsListPageComponent extends BaseComponent implements OnInit, OnDestroy {

    readonly headerFilterValue = signal<EpicSvtTestsListFilterValue>(getDefaultEpicSvtTestsListFilterValue())

    readonly datasource: Signal<IDatasource | undefined>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState | undefined>
    readonly filterData: Signal<EpicSvtTestsListFilterData | null | undefined>

    // DI
    protected readonly dataSource = inject(EpicSvtTestsGridDataSource)
    protected readonly filterDataSource = inject(EpicSvtTestsListFilterDataSource)
    protected readonly epicSvtTestCreateDialogService = inject(EpicSvtTestCreateDialogService)

    constructor() {
        super()
        this.datasource = this.dataSource.datasource
        this.dataFetchingProcessing = this.dataSource.fetchDataProcessing
        this.filterData = toSignal(this.filterDataSource.data$)

        // every filter change hands the grid a new data source, which drops its blocks and starts from the top
        effect(() => {
            this.dataSource.actionSetFilter(
                toEpicSvtTestsListQueryFilter(this.headerFilterValue(), this.filterData()),
            )
        })
    }

    /**
     * No explicit initial load here — the grid asks the data source for the first block as soon as it is
     * rendered, which is also why the grid must never be hidden behind a loader.
     */
    ngOnInit(): void {
        this.dataSource.connect()
        this.filterDataSource.connect()
        this.filterDataSource.load()
    }

    override ngOnDestroy(): void {
        super.ngOnDestroy()
        this.dataSource.disconnect()
        this.dataSource.resetState()
        this.filterDataSource.disconnect()
    }

    onReload(): void {
        this.filterDataSource.load(true)
        this.dataSource.actionReload()
    }

    onCreate(): void {
        this.epicSvtTestCreateDialogService.openDialog({
            onSuccess: () => this.onReload(),
        })
    }

    onEdit(entity: EpicSvtTestTemplate): void {
        console.log('NOT IMPLEMENTED')
    }

    onRowClicked(entity: EpicSvtTestTemplate): void {
        console.log('NOT IMPLEMENTED')
    }

}
