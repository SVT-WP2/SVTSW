import { Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { EpicApiPager } from 'epic-ui/api'
import { BaseStore, ProcessingStore } from 'epic-ui/utils'
import { isEqual } from 'lodash-es'
import { Observable, Subscription, throwError } from 'rxjs'
import { catchError, distinctUntilChanged, map, takeUntil } from 'rxjs/operators'


export type EpicScrollData<TRecord = unknown> = {
    records: TRecord[]
    hasMoreItems: boolean
    totalCount: number | null
    nextPageOffset?: number | undefined
}

export type EpicScrollDataState<TData extends EpicScrollData = EpicScrollData, TFilter = unknown> = {
    data: TData
    filter: TFilter
    batchSize: number
    fetchDataProcessing: ProcessingStore.EventProcessingState
    fetchMoreDataProcessing: ProcessingStore.EventProcessingState
}

export function getDefaultEpicScrollDataState(batchSize = 50): EpicScrollDataState {
    return {
        data: {
            records: [],
            hasMoreItems: true,
            totalCount: null,
            nextPageOffset: undefined,
        },
        filter: {},
        batchSize,
        fetchDataProcessing: ProcessingStore.getDefaultProcessingState(),
        fetchMoreDataProcessing: ProcessingStore.getDefaultProcessingState(),
    }
}


export interface IEpicScrollingDataSource<TRecord = unknown,
    TFilter = unknown,
    TData extends EpicScrollData<TRecord> = EpicScrollData<TRecord>,
    TState extends EpicScrollDataState<TData, TFilter> = EpicScrollDataState<TData, TFilter>>
    extends BaseStore<TState> {

    readonly dataRecords: Signal<TRecord[] | undefined>
    readonly data: Signal<TData | undefined>
    readonly fetchDataProcessing: Signal<ProcessingStore.EventProcessingState | undefined>
    readonly fetchMoreDataProcessing: Signal<ProcessingStore.EventProcessingState | undefined>

    readonly dataRecords$: Observable<TRecord[]>
    readonly data$: Observable<TData>
    readonly fetchDataProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly fetchMoreDataProcessing$: Observable<ProcessingStore.EventProcessingState>

    readonly fetchDataProcessingEvents: ProcessingStore.ProcessingEvents<TState>
    readonly fetchMoreDataProcessingEvents: ProcessingStore.ProcessingEvents<TState>

    actionFetchData(payload?: { filter?: TFilter }): void

    actionFetchMoreData(): void

}

export abstract class EpicBaseScrollingDataSource<TRecord = unknown,
    TFilter = unknown,
    TData extends EpicScrollData<TRecord> = EpicScrollData<TRecord>,
    TState extends EpicScrollDataState<TData, TFilter> = EpicScrollDataState<TData, TFilter>>
    extends BaseStore<TState> implements IEpicScrollingDataSource<TRecord, TFilter, TData, TState> {

    readonly dataRecords$: Observable<TRecord[]>
    readonly data$: Observable<TData>
    readonly fetchDataProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly fetchMoreDataProcessing$: Observable<ProcessingStore.EventProcessingState>

    readonly dataRecords: Signal<TRecord[] | undefined>
    readonly data: Signal<TData | undefined>
    readonly fetchDataProcessing: Signal<ProcessingStore.EventProcessingState | undefined>
    readonly fetchMoreDataProcessing: Signal<ProcessingStore.EventProcessingState | undefined>

    readonly fetchDataProcessingEvents: ProcessingStore.ProcessingEvents<TState>
    readonly fetchMoreDataProcessingEvents: ProcessingStore.ProcessingEvents<TState>

    protected initFetchDataSub: Subscription

    constructor(defaultState?: Partial<TState>) {

        super({
            ...getDefaultEpicScrollDataState(),
            ...(defaultState || {}),
        } as TState)

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

        this.data$ = this.state$
            .pipe(
                map((state) => state.data),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )

        this.dataRecords$ = this.data$
            .pipe(
                map((data) => data.records),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )

        this.fetchDataProcessingEvents = ProcessingStore.createProcessingEvents(
            this.state$,
            (state) => state.fetchDataProcessing,
        )

        this.fetchMoreDataProcessingEvents = ProcessingStore.createProcessingEvents(
            this.state$,
            (state) => state.fetchMoreDataProcessing,
        )

        this.dataRecords = toSignal(this.dataRecords$)
        this.data = toSignal(this.data$)
        this.fetchDataProcessing = toSignal(this.fetchDataProcessing$)
        this.fetchMoreDataProcessing = toSignal(this.fetchMoreDataProcessing$)
    }

    actionFetchData(payload?: { filter?: TFilter }): void {
        this.updateState({
            ...this.state,
            fetchDataProcessing: ProcessingStore.eventProcessingStart(this.state.fetchDataProcessing),
            filter: payload?.filter ?? this.state.filter,
        })

        const pager: EpicApiPager = {
            offset: 0,
            limit: this.state.batchSize,
        }

        this.initFetchDataSub?.unsubscribe()
        this.initFetchDataSub = this.processFetchDataBatch(pager, payload?.filter)
            .pipe(
                takeUntil(this.disconnected$!),
                catchError((error) => {
                    this.updateState({
                        ...this.state,
                        fetchDataProcessing: ProcessingStore.eventProcessingFinish(this.state.fetchDataProcessing, error),
                    })
                    return throwError(() => error)
                }),
            )
            .subscribe((data) => {
                this.updateState({
                    ...this.state,
                    fetchDataProcessing: ProcessingStore.eventProcessingFinish(this.state.fetchDataProcessing),
                    data,
                })
            })
    }

    actionFetchMoreData(): void {
        this.updateState({
            ...this.state,
            fetchMoreDataProcessing: ProcessingStore.eventProcessingStart(this.state.fetchMoreDataProcessing),
        })

        const pager: EpicApiPager = {
            offset: this.state.data.nextPageOffset !== undefined ? this.state.data.nextPageOffset : this.state.data.records.length,
            limit: this.state.batchSize,
        }

        this.processFetchDataBatch(pager, this.state.filter)
            .pipe(
                takeUntil(this.disconnected$!),
                catchError((error) => {
                    this.updateState({
                        ...this.state,
                        fetchMoreDataProcessing: ProcessingStore.eventProcessingFinish(this.state.fetchMoreDataProcessing, error),
                    })
                    return throwError(() => error)
                }),
            )
            .subscribe((data) => {
                this.fetchMoreDataSuccess(data)
            })
    }

    protected fetchMoreDataSuccess(data: TData): void {
        this.updateState({
            ...this.state,
            fetchMoreDataProcessing: ProcessingStore.eventProcessingFinish(this.state.fetchMoreDataProcessing),
            data: {
                ...data,
                records: [...this.state.data.records, ...data.records],
            },
        })
    }

    protected abstract processFetchDataBatch(pager: EpicApiPager, filter?: TFilter): Observable<TData>

}
