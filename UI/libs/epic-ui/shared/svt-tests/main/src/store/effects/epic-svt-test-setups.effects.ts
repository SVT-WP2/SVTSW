import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { concatLatestFrom, mapResponse } from '@ngrx/operators'
import { Store } from '@ngrx/store'
import { EpicSvtTestSetupConfigsApiClient, EpicSvtTestSetupsApiClient } from 'epic-ui/api'
import { delay, forkJoin, mergeMap, of, takeUntil } from 'rxjs'

import { EpicSvtTestSetupsActions } from '../actions'
import { EpicSvtTestSetupsSelectors } from '../selectors'

import StoreAction = EpicSvtTestSetupsActions
import StoreSelectors = EpicSvtTestSetupsSelectors


@Injectable()
export class EpicSvtTestSetupsEffects {

    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)
    protected readonly epicSvtTestSetupsApiClient = inject(EpicSvtTestSetupsApiClient)
    protected readonly epicSvtTestSetupConfigsApiClient = inject(EpicSvtTestSetupConfigsApiClient)

    protected leaveAction$ = this.actions$
        .pipe(
            ofType(StoreAction.leaveAction),
        )

    protected readonly fetchAllRequest$ = createEffect(() =>
        this.actions$
            .pipe(
                ofType(StoreAction.fetchAllRequestAction),
                concatLatestFrom(() => [
                    this.store.select(StoreSelectors.selectIsAllDataFetched),
                    this.store.select(StoreSelectors.selectAllTestSetups),
                    this.store.select(StoreSelectors.selectAllTestSetupConfigs),
                ]),
                mergeMap(([{ force }, isAllDataFetched, testSetups, testSetupConfigs]) => {
                    if (!force && isAllDataFetched) {
                        return of(StoreAction.fetchAllSuccessAction({ testSetups, testSetupConfigs }))
                            .pipe(
                                delay(50),
                            )
                    }

                    return forkJoin({
                        testSetups: this.epicSvtTestSetupsApiClient.fetchList(),
                        testSetupConfigs: this.epicSvtTestSetupConfigsApiClient.fetchList(),
                    })
                        .pipe(
                            takeUntil(this.leaveAction$),
                            mapResponse({
                                next: ({ testSetups, testSetupConfigs }) => (
                                    StoreAction.fetchAllSuccessAction({ testSetups, testSetupConfigs })
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
                    return this.epicSvtTestSetupsApiClient.create(create)
                        .pipe(
                            mergeMap((entity) => forkJoin({
                                testSetup: of(entity),
                                testSetupConfig: this.epicSvtTestSetupConfigsApiClient.fetchOne(entity.defaultConfigId),
                            })),
                            mapResponse({
                                next: ({ testSetup, testSetupConfig }) => (
                                    StoreAction.createSuccessAction({ testSetup, testSetupConfig })
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
                    return this.epicSvtTestSetupsApiClient.update(id, update)
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

    protected readonly createConfigRequest$ = createEffect(() =>
        this.actions$
            .pipe(
                ofType(StoreAction.createConfigRequestAction),
                mergeMap(({ create }) => {
                    return this.epicSvtTestSetupConfigsApiClient.create(create)
                        .pipe(
                            mapResponse({
                                next: (entity) => (
                                    StoreAction.createConfigSuccessAction({ entity })
                                ),
                                error: (error: HttpErrorResponse) => (
                                    StoreAction.createConfigErrorAction({ error })
                                ),
                            }),
                        )
                }),
            ),
    )

}
