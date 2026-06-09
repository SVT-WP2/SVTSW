import { inject, Injectable } from '@angular/core'
import { Actions, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { EpicSvtTestTypeConfig, EpicSvtTestTypeConfigCreate, EpicSvtTestTypeCreate } from 'epic-ui/api'
import { first, merge, Observable, of, switchMap, throwError } from 'rxjs'

import { EpicSvtTestTypesActions } from '../actions'

import StoreActions = EpicSvtTestTypesActions


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTypesStoreFacade {

    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)

    create(create: EpicSvtTestTypeCreate): Observable<StoreActions.CreateSuccessActionPayload> {

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
                        testType: payload.testType,
                        testTypeConfig: payload.testTypeConfig,
                    })
                }),
            )

    }

    createConfig(create: EpicSvtTestTypeConfigCreate): Observable<EpicSvtTestTypeConfig> {

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

