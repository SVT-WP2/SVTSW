import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { concatLatestFrom, mapResponse } from '@ngrx/operators'
import { select, Store } from '@ngrx/store'
import { EpicWpProbeCardsApiClient } from 'epic-ui/api'
import { delay, map, mergeMap, take } from 'rxjs'

import { EpicWpProbeCardsActions } from '../actions'
import { EpicWpProbeCardsSelectors } from '../selectors'

import StoreAction = EpicWpProbeCardsActions
import StoreSelectors = EpicWpProbeCardsSelectors


@Injectable()
export class EpicWpProbeCardsEffects {

    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)
    protected readonly epicWpProbeCardsApiClient = inject(EpicWpProbeCardsApiClient)

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

                    return this.epicWpProbeCardsApiClient.fetchAll()
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

}
