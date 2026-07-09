import { BehaviorSubject, Observable, of, Subject } from 'rxjs'
import { catchError, filter, map, switchMap, take, takeUntil, tap } from 'rxjs/operators'

import { ProcessingStore } from '../store'

import { SearchQuery } from './search-query.models'

import DataState = SearchQuery.DataState
import DEFAULT_RENDER_DATA = SearchQuery.DEFAULT_RENDER_DATA


export abstract class SimpleDataSource<TData, TFilter extends Record<string, any> = Record<string, any>> {

    readonly dataState$: Observable<DataState<TData>>
    readonly data$: Observable<TData | null>

    readonly loadingProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly loadingProcessingEvents: ProcessingStore.ProcessingEvents<DataState<TData>>

    readonly onFilterChanged$ = new Subject<{ filter: TFilter; apply: boolean; force: boolean }>()

    protected readonly _dataState$ = new BehaviorSubject<DataState<TData>>(DEFAULT_RENDER_DATA)
    protected readonly _filter$ = new BehaviorSubject<TFilter>({} as TFilter)

    protected disconnected$ = new Subject<void>()

    constructor() {

        this.dataState$ = this._dataState$.asObservable()
        this.data$ = this.dataState$.pipe(map(data => data.data))

        this.loadingProcessing$ = this.dataState$
            .pipe(
                map((data) => data.loadingProcessing),
            )

        this.loadingProcessingEvents = ProcessingStore.createProcessingEvents(
            this.dataState$,
            (state) => state.loadingProcessing,
        )

        this.init()
    }

    get data(): TData | null {
        return this._dataState$.getValue().data
    }

    get filter(): TFilter {
        return this._filter$.getValue()
    }

    get dataState(): DataState<TData> {
        return this._dataState$.getValue()
    }

    load(force: boolean = false): void {
        this.fetchData(this.filter, force).subscribe()
    }

    setFilter(filterValue: TFilter, apply: boolean = true, force: boolean = false): void {
        this.onFilterChanged$.next({ filter: filterValue, apply, force })
    }

    connect(): void {
        if(!this.disconnected$) {
            this.disconnected$ = new Subject<void>()
            this.init()
        }
    }

    disconnect(): void {
        this.disconnected$.next()
    }

    protected init(): void {
        // FILTER CHANGED EVENT
        this.onFilterChanged$
            .pipe(
                takeUntil(this.disconnected$),
                tap((payload) => this._filter$.next(payload.filter)),
                filter((payload) => payload.apply),
                switchMap((payload) => this.fetchData(payload.filter, payload.force)),
            )
            .subscribe()
    }

    protected fetchData(filterValue: TFilter, force: boolean = false): Observable<TData | null> {

        this.loadingStart()

        return this.getDataObserver(filterValue, force)
            .pipe(
                takeUntil(this.disconnected$),
                catchError((error) => {
                    this.loadingFinish(error)
                    return of(null)
                }),
                // update data state
                tap((result) => {
                    if (result !== null) {
                        this.updateDataState({
                            data: result,
                            loadingProcessing: ProcessingStore.eventProcessingFinish(this.dataState.loadingProcessing),
                        })
                    }
                }),
                take(1),
            )
    }

    protected updateDataState(dataState: Partial<DataState<TData>>): void {
        this._dataState$.next({
            ...this._dataState$.getValue(),
            ...dataState,
        })
    }

    protected loadingStart(): void {
        this.updateDataState({
            loadingProcessing: ProcessingStore.eventProcessingStart(this.dataState.loadingProcessing),
        })
    }

    protected loadingFinish(error: any | null = null): void {
        this.updateDataState({
            loadingProcessing: ProcessingStore.eventProcessingFinish(this.dataState.loadingProcessing, error),
        })
    }

    protected abstract getDataObserver(filterValue: TFilter, force: boolean): Observable<TData>

}

