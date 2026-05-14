import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { concatLatestFrom, mapResponse } from '@ngrx/operators'
import { select, Store } from '@ngrx/store'
import { EpicWpProjectsApiClient } from 'epic-ui/api'
import { delay, map, mergeMap, take } from 'rxjs'

import { EpicWpProjectsActions } from '../actions'
import { EpicWpProjectsSelectors } from '../selectors'

import StoreAction = EpicWpProjectsActions
import StoreSelectors = EpicWpProjectsSelectors


@Injectable()
export class EpicWpProjectsEffects {

    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)
    protected readonly epicWpProjectsApiClient = inject(EpicWpProjectsApiClient)

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

                    return this.epicWpProjectsApiClient.fetchAll()
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
                    return this.epicWpProjectsApiClient.create(create)
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

}
