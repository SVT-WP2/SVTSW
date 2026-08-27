import { Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { IDatasource, IGetRowsParams } from 'ag-grid-community'
import { EpicApiPager, EpicApiPageResponse } from 'epic-ui/api'
import { BaseStore, ProcessingStore } from 'epic-ui/utils'
import { isEqual } from 'lodash-es'
import { BehaviorSubject, distinctUntilChanged, map, Observable, take, takeUntil } from 'rxjs'


export type EpicAgGridInfiniteDataState<TFilter = unknown> = {
    filter: TFilter
    /** Total number of rows behind the current filter, as reported by the last loaded block. */
    totalCount: number | null
    /** Loading of the very first block — the one the page itself waits for. */
    fetchDataProcessing: ProcessingStore.EventProcessingState
    /** Loading of every block after the first one — the grid shows its own loading rows for those. */
    fetchMoreDataProcessing: ProcessingStore.EventProcessingState
}

export function getDefaultEpicAgGridInfiniteDataState<TFilter>(): EpicAgGridInfiniteDataState<TFilter> {
    return {
        filter: {} as TFilter,
        totalCount: null,
        fetchDataProcessing: ProcessingStore.getDefaultProcessingState(),
        fetchMoreDataProcessing: ProcessingStore.getDefaultProcessingState(),
    }
}

/**
 * Data source behind an AG Grid running the *infinite* row model — the community alternative to the enterprise
 * server side row model. The grid asks for one block of rows at a time (`cacheBlockSize`) and this source turns
 * each block into a single paginated API call, so the page never holds more rows than the user scrolled through.
 *
 * A fresh `IDatasource` is emitted whenever the filter changes or a reload is requested — binding it to the
 * grid's `[datasource]` makes the grid drop its cache and start over from the first block.
 */
export abstract class EpicAgGridInfiniteDataSource<TRow = unknown, TFilter = unknown>
    extends BaseStore<EpicAgGridInfiniteDataState<TFilter>> {

    readonly datasource$: Observable<IDatasource>
    readonly totalCount$: Observable<number | null>
    readonly fetchDataProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly fetchMoreDataProcessing$: Observable<ProcessingStore.EventProcessingState>

    readonly datasource: Signal<IDatasource | undefined>
    readonly totalCount: Signal<number | null | undefined>
    readonly fetchDataProcessing: Signal<ProcessingStore.EventProcessingState | undefined>
    readonly fetchMoreDataProcessing: Signal<ProcessingStore.EventProcessingState | undefined>

    protected readonly _datasource$: BehaviorSubject<IDatasource>

    protected constructor(defaultState?: Partial<EpicAgGridInfiniteDataState<TFilter>>) {
        super({
            ...getDefaultEpicAgGridInfiniteDataState<TFilter>(),
            ...(defaultState || {}),
        })

        this._datasource$ = new BehaviorSubject<IDatasource>(this.createDatasource())
        this.datasource$ = this._datasource$.asObservable()

        this.totalCount$ = this.state$
            .pipe(
                map((state) => state.totalCount),
                distinctUntilChanged(),
            )

        this.fetchDataProcessing$ = this.state$
            .pipe(
                map((state) => state.fetchDataProcessing),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )

        this.fetchMoreDataProcessing$ = this.state$
            .pipe(
                map((state) => state.fetchMoreDataProcessing),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )

        this.datasource = toSignal(this.datasource$)
        this.totalCount = toSignal(this.totalCount$)
        this.fetchDataProcessing = toSignal(this.fetchDataProcessing$)
        this.fetchMoreDataProcessing = toSignal(this.fetchMoreDataProcessing$)
    }

    actionSetFilter(filter: TFilter): void {
        // a filter that did not actually change must not throw the loaded blocks away — use actionReload for that
        if (isEqual(filter, this.state.filter)) {
            return
        }

        this.updateState({ filter })
        this.actionReload()
    }

    actionReload(): void {
        this.updateState({
            totalCount: null,
            // the grid drops its cache along with the failed block, so the previous error goes with it
            fetchDataProcessing: ProcessingStore.eventProcessingStart(this.state.fetchDataProcessing),
        })

        this._datasource$.next(this.createDatasource())
    }

    protected createDatasource(): IDatasource {
        return {
            getRows: (params: IGetRowsParams) => this.processGetRows(params),
        }
    }

    protected processGetRows(params: IGetRowsParams): void {
        const pager: EpicApiPager = {
            offset: params.startRow,
            limit: params.endRow - params.startRow,
        }
        const isFirstBlock = params.startRow === 0

        this.processingStart(isFirstBlock)

        this.fetchDataBlock(pager, this.state.filter)
            .pipe(
                takeUntil(this.disconnected$!),
                take(1),
            )
            .subscribe({
                next: ({ items, totalCount }) => {
                    this.updateState({ totalCount })
                    this.processingFinish(isFirstBlock)
                    // handing over the exact total lets the grid size its scrollbar without guessing
                    params.successCallback(items, totalCount)
                },
                error: (error: Error) => {
                    this.processingFinish(isFirstBlock, error)
                    params.failCallback()
                },
            })
    }

    protected processingStart(isFirstBlock: boolean): void {
        this.updateState(isFirstBlock
            ? { fetchDataProcessing: ProcessingStore.eventProcessingStart(this.state.fetchDataProcessing) }
            : { fetchMoreDataProcessing: ProcessingStore.eventProcessingStart(this.state.fetchMoreDataProcessing) })
    }

    protected processingFinish(isFirstBlock: boolean, error: Error | null = null): void {
        this.updateState(isFirstBlock
            ? { fetchDataProcessing: ProcessingStore.eventProcessingFinish(this.state.fetchDataProcessing, error) }
            : { fetchMoreDataProcessing: ProcessingStore.eventProcessingFinish(this.state.fetchMoreDataProcessing, error) })
    }

    protected abstract fetchDataBlock(pager: EpicApiPager, filter: TFilter): Observable<EpicApiPageResponse<TRow>>

}
