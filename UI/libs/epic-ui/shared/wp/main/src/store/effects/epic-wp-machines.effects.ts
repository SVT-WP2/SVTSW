import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { concatLatestFrom, mapResponse } from '@ngrx/operators'
import { select, Store } from '@ngrx/store'
import { EpicWpMachinesApiClient } from 'epic-ui/api'
import { delay, map, mergeMap, of, take } from 'rxjs'

import { EpicWpMachinesActions } from '../actions'
import { EpicWpMachinesSelectors } from '../selectors'

import StoreAction = EpicWpMachinesActions
import StoreSelectors = EpicWpMachinesSelectors


@Injectable()
export class EpicWpMachinesEffects {

    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)
    protected readonly epicWpMachinesApiClient = inject(EpicWpMachinesApiClient)

    protected readonly fetchAllRequest$ = createEffect(() =>
        this.actions$
            .pipe(
                ofType(StoreAction.fetchAllRequestAction),
                concatLatestFrom(() => (this.store.pipe(select(StoreSelectors.selectIsAllDataFetched)))),
                mergeMap(([{ force }, isAllDataFetched]) => {
                    if (!force && isAllDataFetched) {
                        return this.store.pipe(select(StoreSelectors.selectAllEntitiesList))
                            .pipe(
                                take(1),
                                map((entities) => StoreAction.fetchAllSuccessAction({ entities })),
                                delay(50),
                            )
                    }

                    return this.epicWpMachinesApiClient.fetchAll()
                        .pipe(
                            mapResponse({
                                next: (entities) => (
                                    StoreAction.fetchAllSuccessAction({ entities })
                                ),
                                error: (error: HttpErrorResponse) => (
                                    StoreAction.fetchAllErrorAction({ error })
                                ),
                            }),
                        )
                }),
            ),
    )

    protected readonly createRequest$ = createEffect(() =>
        this.actions$
            .pipe(
                ofType(StoreAction.createRequestAction),
                mergeMap(({ create }) => {
                    return this.epicWpMachinesApiClient.create(create)
                        .pipe(
                            mapResponse({
                                next: (entity) => (
                                    StoreAction.createSuccessAction({ entity })
                                ),
                                error: (error: HttpErrorResponse) => (
                                    StoreAction.createErrorAction({ error })
                                ),
                            }),
                        )
                }),
            ),
    )

    protected readonly updateRequest$ = createEffect(() =>
        this.actions$
            .pipe(
                ofType(StoreAction.updateRequestAction),
                mergeMap(({ id, update }) => {
                    return this.epicWpMachinesApiClient.update(id, update)
                        .pipe(
                            mapResponse({
                                next: (entity) => (
                                    StoreAction.updateSuccessAction({ entity })
                                ),
                                error: (error: HttpErrorResponse) => (
                                    StoreAction.updateErrorAction({ error })
                                ),
                            }),
                        )
                }),
            ),
    )

    protected readonly updateInstalledProbeCardRequest$ = createEffect(() =>
        this.actions$
            .pipe(
                ofType(StoreAction.updateInstalledProbeCardRequestAction),
                mergeMap(({ wpMachineId, installedProbeCardId }) => {
                    return this.epicWpMachinesApiClient.updateInstalledProbeCard(wpMachineId, installedProbeCardId)
                        .pipe(
                            mapResponse({
                                next: (entity) => (
                                    StoreAction.updateInstalledProbeCardSuccessAction({ entity })
                                ),
                                error: (error: HttpErrorResponse) => (
                                    StoreAction.updateInstalledProbeCardErrorAction({ error })
                                ),
                            }),
                        )
                }),
            ),
    )

    protected readonly updateLoadedWaferRequest$ = createEffect(() =>
        this.actions$
            .pipe(
                ofType(StoreAction.updateLoadedWaferRequestAction),
                concatLatestFrom(({wpMachineId}) => (this.store.pipe(select(StoreSelectors.selectOneEntityById(wpMachineId))))),
                mergeMap(([{ wpMachineId, loadedWaferId }, wpMachine]) => {

                    const wpMachine$ = wpMachine?.loadedWaferId === loadedWaferId
                        ? of({...wpMachine})
                        : this.epicWpMachinesApiClient.updateLoadedWafer(wpMachineId, loadedWaferId)

                    return wpMachine$
                        .pipe(
                            mapResponse({
                                next: (entity) => (
                                    StoreAction.updateLoadedWaferSuccessAction({ entity })
                                ),
                                error: (error: HttpErrorResponse) => (
                                    StoreAction.updateLoadedWaferErrorAction({ error })
                                ),
                            }),
                        )
                }),
            ),
    )

}
