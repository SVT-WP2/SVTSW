import { inject, Injectable } from '@angular/core'
import { Actions, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { EpicSvtTestSetupConfig, EpicSvtTestSetupConfigCreate, EpicSvtTestSetupCreate } from 'epic-ui/api'
import { first, merge, Observable, of, switchMap, throwError } from 'rxjs'

import { EpicSvtTestSetupsActions } from '../actions'

import StoreActions = EpicSvtTestSetupsActions


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupsStoreFacade {

    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)

    create(create: EpicSvtTestSetupCreate): Observable<StoreActions.CreateSuccessActionPayload> {

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

    createConfig(create: EpicSvtTestSetupConfigCreate): Observable<EpicSvtTestSetupConfig> {

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
