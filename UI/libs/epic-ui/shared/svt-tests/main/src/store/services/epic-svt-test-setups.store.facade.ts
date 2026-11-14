import { inject, Injectable } from '@angular/core'
import { Actions, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { first, merge, Observable, of, switchMap, throwError } from 'rxjs'
import { EpicSvtTestSetupConfig, EpicSvtTestSetupConfigCreateRequest, EpicSvtTestSetupCreateRequest } from 'svt-ts-types'

import { EpicSvtTestSetupsActions } from '../actions'

import StoreActions = EpicSvtTestSetupsActions


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupsStoreFacade {

    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)

    create(create: EpicSvtTestSetupCreateRequest): Observable<StoreActions.CreateSuccessActionPayload> {

        this.store.dispatch(StoreActions.createRequestAction({ create }))

        const success$ = this.actions$
            .pipe(
                ofType(StoreActions.createSuccessAction),
            )

        const error$ = this.actions$
            .pipe(
                ofType(StoreActions.createErrorAction),
            )

        return merge(success$, error$)
            .pipe(
                first(),
                switchMap((payload) => {
                    if (payload.type === StoreActions.createErrorAction.type) {
                        return throwError(() => payload.error)
                    }
                    return of({
                        testSetup: payload.testSetup,
                        testSetupConfig: payload.testSetupConfig,
                    })
                }),
            )

    }

    createConfig(create: EpicSvtTestSetupConfigCreateRequest): Observable<EpicSvtTestSetupConfig> {

        this.store.dispatch(StoreActions.createConfigRequestAction({ create }))

        const success$ = this.actions$
            .pipe(
                ofType(StoreActions.createConfigSuccessAction),
            )

        const error$ = this.actions$
            .pipe(
                ofType(StoreActions.createConfigErrorAction),
            )

        return merge(success$, error$)
            .pipe(
                first(),
                switchMap((payload) => {
                    if (payload.type === StoreActions.createConfigErrorAction.type) {
                        return throwError(() => payload.error)
                    }
                    return of(payload.entity)
                }),
            )

    }

}
