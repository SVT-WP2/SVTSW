import { inject, Injectable } from '@angular/core'
import { EpicWafer, EpicWaferCreate, EpicWaferLocationUpdate, EpicWafersApiClient, EpicWaferUpdate } from 'epic-ui/api'
import { BaseStore, EntityStore, ProcessingStore } from 'epic-ui/utils'
import { isEqual } from 'lodash-es'
import { catchError, distinctUntilChanged, first, map, Observable, of, switchMap, throwError } from 'rxjs'

import { EpicWafersStore } from '../models'

import Store = EpicWafersStore


@Injectable({ providedIn: 'root' })
export class EpicWafersStoreFacade extends BaseStore<Store.State> {

    readonly wafersList$: Observable<EpicWafer[]>
    readonly fetchAllProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly fetchOneProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly deleteProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly updateProcessing$: Observable<ProcessingStore.EventProcessingState>

    readonly deleteProcessingEvents: ProcessingStore.ProcessingEvents<Store.State>
    readonly updateProcessingEvents: ProcessingStore.ProcessingEvents<Store.State>
    readonly fetchOneProcessingEvents: ProcessingStore.ProcessingEvents<Store.State>
    readonly fetchAllProcessingEvents: ProcessingStore.ProcessingEvents<Store.State>

    // DI
    protected readonly epicWafersApiClient = inject(EpicWafersApiClient)

    constructor() {
        super(Store.getDefaultState())

        this.wafersList$ = this.state$
            .pipe(
                map((state) => EntityStore.selectAll<EpicWafer>(state.wafers)),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )

        this.fetchAllProcessing$ = this.state$
            .pipe(
                map((state) => state.fetchAllProcessing),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )

        this.fetchOneProcessing$ = this.state$
            .pipe(
                map((state) => state.fetchOneProcessing),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )

        this.deleteProcessing$ = this.state$
            .pipe(
                map((state) => state.deleteProcessing),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )

        this.deleteProcessingEvents = ProcessingStore.createProcessingEvents(
            this.state$,
            (state => state.deleteProcessing),
        )

        this.updateProcessing$ = this.state$
            .pipe(
                map((state) => state.updateProcessing),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )

        this.updateProcessingEvents = ProcessingStore.createProcessingEvents(
            this.state$,
            (state => state.updateProcessing),
        )

        this.fetchOneProcessingEvents = ProcessingStore.createProcessingEvents(
            this.state$,
            (state => state.fetchOneProcessing),
        )

        this.fetchAllProcessingEvents = ProcessingStore.createProcessingEvents(
            this.state$,
            (state => state.fetchAllProcessing),
        )

    }

    actionFetchAll(payload?: { force?: boolean }): void {

        if (this.state.isAllDataFetched && !payload?.force) {
            // do nothing
            return
        }

        this.updateState(
            Store.reduceActionFetchAllRequest(this.state),
        )

        this.fetchWafersList()
            .pipe(
                catchError((err) => {
                    this.updateState(
                        Store.reduceActionFetchAllError(this.state, err),
                    )
                    return throwError(err)
                }),
            )
            .subscribe((wafersList: EpicWafer[]) => {
                this.updateState(
                    Store.reduceActionFetchAllSuccess(this.state, wafersList),
                )
            })
    }

    actionFetchOne(waferId: number, force: boolean = false): void {
        this.updateState(
            Store.reduceActionFetchOneRequest(this.state),
        )

        const wafer = this.selectOneWafer(waferId)

        if (wafer && !force) {
            this.updateState(
                Store.reduceActionFetchOneSuccess(this.state, wafer),
            )
            return
        }

        this.fetchOneWafer(waferId)
            .pipe(
                switchMap((wafer: EpicWafer | undefined) => {
                    if (!wafer) {
                        return throwError(() => new Error(`Wafer with ID ${waferId} does not exist ...`))
                    }
                    return of(wafer)
                }),
                catchError((err) => {
                    this.updateState(
                        Store.reduceActionFetchOneError(this.state, err),
                    )
                    return throwError(() => err)
                }),
            )
            .subscribe((wafer: EpicWafer) => {
                this.updateState(
                    Store.reduceActionFetchOneSuccess(this.state, wafer),
                )
            })
    }

    actionCreate(payload: EpicWaferCreate): void {
        this.updateState(
            Store.reduceActionUpdateRequest(this.state),
        )

        this.processCreate(payload)
            .pipe(
                catchError((err) => {
                    this.updateState(
                        Store.reduceActionUpdateError(this.state, err),
                    )
                    return throwError(() => err)
                }),
            )
            .subscribe((wafer: EpicWafer) => {
                this.updateState(
                    Store.reduceActionUpdateSuccess(this.state, wafer),
                )
            })
    }

    actionUpdate(id: number, update: EpicWaferUpdate): void {
        this.updateState(
            Store.reduceActionUpdateRequest(this.state),
        )

        this.processUpdate(id, update)
            .pipe(
                catchError((err) => {
                    this.updateState(
                        Store.reduceActionUpdateError(this.state, err),
                    )
                    return throwError(() => err)
                }),
            )
            .subscribe((wafer: EpicWafer) => {
                this.updateState(
                    Store.reduceActionUpdateSuccess(this.state, wafer),
                )
            })
    }

    actionUpdateLocation(id: number, update: EpicWaferLocationUpdate): void {
        this.updateState(
            Store.reduceActionUpdateRequest(this.state),
        )

        this.processLocationUpdate(id, update)
            .pipe(
                catchError((err) => {
                    this.updateState(
                        Store.reduceActionUpdateError(this.state, err),
                    )
                    return throwError(() => err)
                }),
            )
            .subscribe((wafer: EpicWafer) => {
                this.updateState(
                    Store.reduceActionUpdateSuccess(this.state, wafer),
                )
            })
    }

    actionDeleteOne(waferId: number): void {
        this.updateState(
            Store.reduceActionDeleteRequest(this.state),
        )

        this.processDeleteOne(waferId)
            .pipe(
                catchError((err) => {
                    this.updateState(
                        Store.reduceActionDeleteError(this.state, err),
                    )
                    return throwError(() => err)
                }),
            )
            .subscribe((wafer: EpicWafer) => {
                this.updateState(
                    Store.reduceActionDeleteSuccess(this.state, waferId),
                )
            })
    }

    selectOneWaferStream(waferId: number): Observable<EpicWafer | undefined> {
        return this.state$
            .pipe(
                map(state => state.wafers.entities[waferId]),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )
    }

    selectAll(): EpicWafer[] {
        return this.state.wafers.ids.map(id => this.state.wafers.entities[id]!)
    }

    selectOneWafer(waferId: number): EpicWafer | undefined {
        return this.state.wafers.entities[waferId]
    }

    fetchAll$(force = false): Observable<EpicWafer[]> {
        if (!force && this.state.isAllDataFetched) {
            return of(this.selectAll())
        }

        this.actionFetchAll({ force })
        return this.fetchAllProcessingEvents.processingEnd$
            .pipe(
                first(),
                switchMap(state => {
                    if (state.fetchAllProcessing.processingError !== null) {
                        return throwError(() => state.fetchAllProcessing.processingError)
                    }
                    return of(this.selectAll())
                }),
            )
    }

    protected fetchWafersList(): Observable<EpicWafer[]> {
        return this.epicWafersApiClient.fetchAll()
    }

    protected fetchOneWafer(waferId: number): Observable<EpicWafer | undefined> {
        return this.epicWafersApiClient.fetchOne(waferId)
    }

    protected processDeleteOne(waferId: number): Observable<EpicWafer> {
        return this.epicWafersApiClient.deleteOne(waferId)
    }

    protected processCreate(createRequest: EpicWaferCreate): Observable<EpicWafer> {
        return this.epicWafersApiClient.create(createRequest)
    }

    protected processUpdate(id: number, update: EpicWaferUpdate): Observable<EpicWafer> {
        return this.epicWafersApiClient.update(id, update)
    }

    protected processLocationUpdate(id: number, update: EpicWaferLocationUpdate): Observable<EpicWafer> {
        return this.epicWafersApiClient.updateWaferLocation(id, update)
    }

}
