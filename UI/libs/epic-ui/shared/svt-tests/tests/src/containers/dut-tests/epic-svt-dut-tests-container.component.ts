import { Component, computed, effect, inject, input, OnDestroy, OnInit, signal, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { EpicSvtDutEntityName } from 'epic-ui/api'
import { EpicButtonModule, EpicContentErrorMessagePipe, EpicContentErrorModule, EpicLoaderComponent } from 'epic-ui/common/components'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import { EpicSvtDutTestsListComponent, EpicSvtDutTestsStatsComponent, EpicSvtTestsListFilterComponent } from '../../components'
import {
    EpicSvtDutTestsStats,
    EpicSvtTestsGrid,
    EpicSvtTestsListFilterData,
    EpicSvtTestsListFilterValue,
    getDefaultEpicSvtTestsListFilterValue,
    getEpicSvtDutTestsStats,
    isEpicSvtTestsListFilterValueEmpty,
    matchesEpicSvtTestsListQueryFilter,
    toEpicSvtTestsListQueryFilter,
} from '../../models'
import { EpicSvtDutTestsDataSource, EpicSvtTestsListFilterDataSource } from '../../services'


/**
 * The tests of one single DUT, together with the statistics they add up to. Unlike the global list this one
 * holds every row of its DUT at once, so both the filter bar and the statistics are answered locally.
 *
 * Both data sources are provided here rather than in the root injector: they belong to the DUT this component
 * was handed, and they are disconnected together with it.
 */
@Component({
    selector: 'epic-svt-dut-tests-container',
    templateUrl: 'epic-svt-dut-tests-container.component.html',
    providers: [
        EpicSvtDutTestsDataSource,
        EpicSvtTestsListFilterDataSource,
    ],
    imports: [
        EpicButtonModule,
        EpicContentErrorMessagePipe,
        EpicContentErrorModule,
        EpicLoaderComponent,
        EpicSvtDutTestsListComponent,
        EpicSvtDutTestsStatsComponent,
        EpicSvtTestsListFilterComponent,
    ],
})
export class EpicSvtDutTestsContainerComponent extends BaseComponent implements OnInit, OnDestroy {

    readonly dutEntityName = input.required<EpicSvtDutEntityName>()
    readonly dutId = input.required<number>()

    readonly headerFilterValue = signal<EpicSvtTestsListFilterValue>(getDefaultEpicSvtTestsListFilterValue())

    readonly entitiesList: Signal<EpicSvtTestsGrid.RowEntity[] | null | undefined>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState | undefined>
    readonly filterData: Signal<EpicSvtTestsListFilterData | null | undefined>

    /** The filter bar is answered here — every row of the DUT is already in, nothing is fetched again. */
    readonly filteredEntitiesList = computed<EpicSvtTestsGrid.RowEntity[]>(() => {
        const queryFilter = toEpicSvtTestsListQueryFilter(this.headerFilterValue(), this.filterData())

        return (this.entitiesList() || [])
            .filter(item => matchesEpicSvtTestsListQueryFilter(item, queryFilter))
    })

    /** The statistics follow the filter bar, so with nothing filtered they cover the whole history of the DUT. */
    readonly stats = computed<EpicSvtDutTestsStats>(() => getEpicSvtDutTestsStats(this.filteredEntitiesList()))

    /**
     * The same over the whole history, so a filtered count can be read against the one it was taken out of.
     * Only while something is actually filtered out — with an empty filter bar both would say the same thing.
     */
    readonly totalStats = computed<EpicSvtDutTestsStats | null>(() => (
        isEpicSvtTestsListFilterValueEmpty(this.headerFilterValue())
            ? null
            : getEpicSvtDutTestsStats(this.entitiesList() || [])
    ))

    // DI
    protected readonly dataSource = inject(EpicSvtDutTestsDataSource)
    protected readonly filterDataSource = inject(EpicSvtTestsListFilterDataSource)

    constructor() {
        super()

        this.entitiesList = toSignal(this.dataSource.data$)
        this.dataFetchingProcessing = toSignal(this.dataSource.loadingProcessing$)
        this.filterData = toSignal(this.filterDataSource.data$)

        // a different DUT is a different list — setting the filter is what triggers the initial load as well
        effect(() => {
            this.dataSource.setFilter({
                dutEntityName: this.dutEntityName(),
                dutId: this.dutId(),
            })
        })
    }

    ngOnInit(): void {
        this.filterDataSource.load()
    }

    override ngOnDestroy(): void {
        super.ngOnDestroy()
        this.dataSource.disconnect()
        this.filterDataSource.disconnect()
    }

    reload(): void {
        this.filterDataSource.load(true)
        this.dataSource.load(true)
    }

}
