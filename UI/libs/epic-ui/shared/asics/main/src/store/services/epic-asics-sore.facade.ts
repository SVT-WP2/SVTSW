import { inject, Injectable } from '@angular/core'
import { EpicAsic, EpicAsicCreate, EpicAsicsApiClient } from 'epic-ui/api'
import { BaseStore, EntityStore, ProcessingStore } from 'epic-ui/utils'
import { isEqual } from 'lodash-es'
import { catchError, distinctUntilChanged, map, Observable, of, switchMap, throwError } from 'rxjs'

import { EpicAsicsStore } from '../models'

import Store = EpicAsicsStore


@Injectable()
export class EpicAsicsStoreFacade extends BaseStore<Store.State> {

    readonly asicsList$: Observable<EpicAsic[]>
    readonly fetchAllProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly fetchOneProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly deleteProcessing$: Observable<ProcessingStore.EventProcessingState>
    readonly updateProcessing$: Observable<ProcessingStore.EventProcessingState>

    readonly deleteProcessingEvents: ProcessingStore.ProcessingEvents<Store.State>
    readonly updateProcessingEvents: ProcessingStore.ProcessingEvents<Store.State>

    // DI
    protected readonly epicAsicsApiClient = inject(EpicAsicsApiClient)

    constructor() {
        super(Store.getDefaultState())

        this.asicsList$ = this.state$
            .pipe(
                map((state) => EntityStore.selectAll<EpicAsic>(state.asics)),
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

    }

    actionFetchAll(payload?: { waferId?: number; force?: boolean }): void {

        if (
            (
                this.state.isAllDataFetched
                || (payload?.waferId && this.state.allAsicsForWaferFetched[payload.waferId])
            )
            && !payload?.force) {
            // do nothing
            return
        }

        this.updateState(
            Store.reduceActionFetchAllRequest(this.state, payload?.waferId),
        )

        this.fetchAllAsicsList(payload?.waferId)
            .pipe(
                catchError((err) => {
                    this.updateState(
                        Store.reduceActionFetchAllError(this.state, err.message),
                    )
                    return throwError(err)
                }),
            )
            .subscribe((entitiesList: EpicAsic[]) => {
                this.updateState(
                    Store.reduceActionFetchAllSuccess(this.state, entitiesList, payload?.waferId),
                )
            })
    }

    actionFetchOne(payload: { asicId: number; force?: boolean }): void {
        this.updateState(
            Store.reduceActionFetchOneRequest(this.state),
        )

        const entity = this.selectOneAsic(payload.asicId)

        if (entity && !payload.force) {
            this.updateState(
                Store.reduceActionFetchOneSuccess(this.state, entity),
            )
            return
        }

        this.fetchOneAsic(payload.asicId)
            .pipe(
                switchMap((wafer: EpicAsic | undefined) => {
                    if (!wafer) {
                        return throwError(() => new Error(`Asic with ID ${payload.asicId} does not exist ...`))
                    }
                    return of(wafer)
                }),
                catchError((err) => {
                    this.updateState(
                        Store.reduceActionFetchOneError(this.state, err.message),
                    )
                    return throwError(err)
                }),
            )
            .subscribe((entity: EpicAsic) => {
                this.updateState(
                    Store.reduceActionFetchOneSuccess(this.state, entity),
                )
            })
    }

    actionCreate(payload: EpicAsicCreate): void {
        this.updateState(
            Store.reduceActionUpdateRequest(this.state),
        )

        this.processCreate(payload)
            .pipe(
                catchError((err) => {
                    this.updateState(
                        Store.reduceActionUpdateError(this.state, err.message),
                    )
                    return throwError(err)
                }),
            )
            .subscribe((wafer: EpicAsic) => {
                this.updateState(
                    Store.reduceActionUpdateSuccess(this.state, wafer),
                )
            })
    }

    actionDeleteOne(asicId: number): void {
        this.updateState(
            Store.reduceActionDeleteRequest(this.state),
        )

        this.processDeleteOne(asicId)
            .pipe(
                catchError((err) => {
                    this.updateState(
                        Store.reduceActionDeleteError(this.state, err.message),
                    )
                    return throwError(err)
                }),
            )
            .subscribe((asic: EpicAsic) => {
                this.updateState(
                    Store.reduceActionDeleteSuccess(this.state, asicId),
                )
            })
    }

    selectWaferAsicsStream(waferId: number): Observable<EpicAsic[]> {
        return this.state$
            .pipe(
                map(state => state.asics.ids
                    .filter(id => this.state.asics.entities[id]?.waferId == waferId)
                    .map(id => this.state.asics.entities[id]!),
                ),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )
    }

    selectOneAsicStream(entityId: number): Observable<EpicAsic | undefined> {
        return this.state$
            .pipe(
                map(state => state.asics.entities[entityId]),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )
    }

    selectOneAsic(entityId: number): EpicAsic | undefined {
        return this.state.asics.entities[entityId]
    }

    protected fetchAllAsicsList(waferId?: number): Observable<EpicAsic[]> {
        return this.epicAsicsApiClient.fetchAllAsicsList({ waferId })
    }

    protected fetchOneAsic(asicId: number): Observable<EpicAsic | undefined> {
        return this.epicAsicsApiClient.fetchOne(asicId)
    }

    protected processDeleteOne(asicId: number): Observable<EpicAsic> {
        return this.epicAsicsApiClient.deleteOne(asicId)
    }

    protected processCreate(createRequest: EpicAsicCreate): Observable<EpicAsic> {
        return this.epicAsicsApiClient.create(createRequest)
    }

}
