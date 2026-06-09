import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { concatLatestFrom, mapResponse } from '@ngrx/operators'
import { Store } from '@ngrx/store'
import { EpicWafersApiClient, EpicWaferTest, EpicWaferTestsApiClient } from 'epic-ui/api'
import { EpicAsicTestTypesFacade } from 'epic-ui/shared/asic-tests'
import { EpicWpMachinesFacade } from 'epic-ui/shared/wp'
import { keyBy } from 'lodash-es'
import { delay, forkJoin, map, mergeMap, Observable, of, switchMap, take } from 'rxjs'

import { EpicWaferTestExtended } from '../../models'
import { EpicWaferTestsActions } from '../actions'
import { EpicWaferTestsSelectors } from '../selectors'

import StoreAction = EpicWaferTestsActions
import StoreSelectors = EpicWaferTestsSelectors


@Injectable()
export class EpicWaferTestsEffects {

    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)
    protected readonly epicWaferTestsApiClient = inject(EpicWaferTestsApiClient)
    protected readonly epicAsicTestTypesFacade = inject(EpicAsicTestTypesFacade)
    protected readonly epicWpMachinesFacade = inject(EpicWpMachinesFacade)
    protected readonly epicWafersApiClient = inject(EpicWafersApiClient)

    protected readonly fetchAllRequest$ = createEffect(() =>
        this.actions$
            .pipe(
                ofType(StoreAction.fetchAllRequestAction),
                concatLatestFrom(() => (this.store.select(StoreSelectors.selectIsAllDataFetched))),
                mergeMap(([{ force }, isAllDataFetched]) => {
                    if (!force && isAllDataFetched) {
                        return this.store.select(StoreSelectors.selectAllWaferTests)
                            .pipe(
                                take(1),
                                map((entities) => StoreAction.fetchAllSuccessAction({ entities })),
                                delay(50),
                            )
                    }

                    return this.fetchList()
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

    protected readonly fetchOneRequest$ = createEffect(() =>
        this.actions$
            .pipe(
                ofType(StoreAction.fetchOneRequestAction),
                mergeMap(({ entityId, force }) => {

                    const entity$ = force
                        ? this.fetchOne(entityId)
                        : this.store.select(StoreSelectors.selectOneWaferTest(entityId))
                            .pipe(
                                take(1),
                                switchMap(entity => entity ? of(entity) : this.fetchOne(entityId)),
                            )

                    return entity$
                        .pipe(
                            mapResponse({
                                next: (entity) => (
                                    StoreAction.fetchOneSuccessAction({ entity })
                                ),
                                error: (error: HttpErrorResponse) => (
                                    StoreAction.fetchOneErrorAction({ error })
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
                    return this.epicWaferTestsApiClient.create(create)
                        .pipe(
                            switchMap(entity => this.decorate(entity)),
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
                    return this.epicWaferTestsApiClient.update(id, update)
                        .pipe(
                            switchMap(entity => this.decorate(entity)),
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

    protected fetchList(): Observable<EpicWaferTestExtended[]> {
        return forkJoin({
            wafers: this.epicWafersApiClient.fetchAll(),
            wpMachines: this.epicWpMachinesFacade.fetchAll(),
            asicTestTypes: this.epicAsicTestTypesFacade.fetchAll(),
            waferTests: this.epicWaferTestsApiClient.fetchAll(),
        })
            .pipe(
                map(({ wafers, wpMachines, asicTestTypes, waferTests }) => {

                    const wafersMap = keyBy(wafers, 'id')
                    const wpMachinesMap = keyBy(wpMachines, 'id')
                    const asicTestTypesMap = keyBy(asicTestTypes, 'id')

                    return waferTests.map(item => ({
                        ...item,
                        wafer: wafersMap[item.waferId] || null,
                        wpMachine: wpMachinesMap[item.wpMachineId] || null,
                        asicTestType: asicTestTypesMap[item.asicTestTypeId] || null,
                    }))
                }),
            )
    }

    protected fetchOne(id: number): Observable<EpicWaferTestExtended> {
        return this.epicWaferTestsApiClient.fetchOne(id)
            .pipe(
                switchMap(entity => this.decorate(entity)),
            )
    }

    protected decorate(entity: EpicWaferTest): Observable<EpicWaferTestExtended> {
        return forkJoin({
            wafers: this.epicWafersApiClient.fetchAll(),
            wpMachines: this.epicWpMachinesFacade.fetchAll(),
            asicTestTypes: this.epicAsicTestTypesFacade.fetchAll(),
        })
            .pipe(
                map(({ wafers, wpMachines, asicTestTypes }) => {
                    return {
                        ...entity,
                        wafer: wafers.find(item => item.id === entity.waferId) || null,
                        wpMachine: wpMachines.find(item => item.id === entity.wpMachineId) || null,
                        asicTestType: asicTestTypes.find(item => item.id === entity.asicTestTypeId) || null,
                    }
                }),
            )
    }

}
