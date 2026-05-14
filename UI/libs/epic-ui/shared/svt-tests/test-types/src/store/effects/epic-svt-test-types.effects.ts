import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { concatLatestFrom, mapResponse } from '@ngrx/operators'
import { Store } from '@ngrx/store'
import { EpicSvtTestTypeConfigsApiClient, EpicSvtTestTypesApiClient } from 'epic-ui/api'
import { delay, forkJoin, map, mergeMap, of, takeUntil } from 'rxjs'

import { EpicSvtTestTypesActions } from '../actions'
import { EpicSvtTestTypesSelectors } from '../selectors'

import StoreAction = EpicSvtTestTypesActions
import StoreSelectors = EpicSvtTestTypesSelectors


@Injectable()
export class EpicSvtTestTypesEffects {

    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)
    protected readonly epicSvtTestTypesApiClient = inject(EpicSvtTestTypesApiClient)
    protected readonly epicSvtTestTypeConfigsApiClient = inject(EpicSvtTestTypeConfigsApiClient)

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
                    this.store.select(StoreSelectors.selectAllTestTypes),
                    this.store.select(StoreSelectors.selectAllTestTypeConfigs),
                ]),
                mergeMap(([{ force }, isAllDataFetched, testTypes, testTypeConfigs]) => {
                    if (!force && isAllDataFetched) {
                        return of(StoreAction.fetchAllSuccessAction({ testTypes, testTypeConfigs }))
                            .pipe(
                                delay(50),
                            )
                    }

                    return forkJoin({
                        testTypes: this.epicSvtTestTypesApiClient.fetchList(),
                        testTypeConfigs: this.epicSvtTestTypeConfigsApiClient.fetchList(),
                    })
                        .pipe(
                            takeUntil(this.leaveAction$),
                            mapResponse({
                                next: ({ testTypes, testTypeConfigs }) => (
                                    StoreAction.fetchAllSuccessAction({ testTypes, testTypeConfigs })
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
                    return this.epicSvtTestTypesApiClient.create(create)
                        .pipe(
                            mergeMap((entity) => forkJoin({
                                testType: of(entity),
                                testTypeConfigs: this.epicSvtTestTypeConfigsApiClient.fetchList({ testTypeId: entity.id }),
                            })),
                            map(({ testType, testTypeConfigs }) => ({
                                testType,
                                testTypeConfig: testTypeConfigs[0],
                            })),
                            mapResponse({
                                next: ({ testType, testTypeConfig }) => (
                                    StoreAction.createSuccessAction({ testType, testTypeConfig })
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
                    return this.epicSvtTestTypesApiClient.update(id, update)
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
                    return this.epicSvtTestTypeConfigsApiClient.create(create)
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

