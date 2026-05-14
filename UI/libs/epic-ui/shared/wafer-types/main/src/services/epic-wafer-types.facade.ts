import { inject, Injectable } from '@angular/core'
import { Actions, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { EpicWaferType } from 'epic-ui/api'
import { map, merge, Observable, of, switchMap, take, throwError } from 'rxjs'

import { EpicWaferTypesActions } from '../store'

import StoreActions = EpicWaferTypesActions


@Injectable({ providedIn: 'root' })
export class EpicWaferTypesFacade {

    protected readonly store = inject(Store)
    protected readonly actions = inject(Actions)

    fetchAll(force?: boolean): Observable<EpicWaferType[]> {

        this.store.dispatch(StoreActions.fetchAllRequestAction({ force }))

        const data$: Observable<EpicWaferType[]> = this.actions
            .pipe(
                ofType(StoreActions.fetchAllSuccessAction),
                take(1),
                map(({ entities }) => entities),
            )

        const error$ = this.actions
            .pipe(
                ofType(StoreActions.fetchAllErrorAction),
                take(1),
                map(({ error }) => error),
            )

        return merge(data$, error$)
            .pipe(
                take(1),
                switchMap((entities) => entities instanceof Error ? throwError(() => entities) : of(entities)),
            )
    }

}
