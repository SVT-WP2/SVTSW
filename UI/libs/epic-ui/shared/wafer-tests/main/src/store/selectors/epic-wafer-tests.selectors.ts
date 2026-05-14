import { createFeatureSelector, createSelector } from '@ngrx/store'

import { EpicWaferTestsStore } from '../epic-wafer-tests.store'


export namespace EpicWaferTestsSelectors {

    export const selectFeature = createFeatureSelector<EpicWaferTestsStore.State>(EpicWaferTestsStore.FEATURE_NAME)

    export const selectFetchAllProcessing = createSelector(
        selectFeature,
        (state) => state.fetchAllProcessing,
    )

    export const selectIsAllDataFetched = createSelector(
        selectFeature,
        (state) => state.isAllDataFetched,
    )

    export const selectWaferTestsState = createSelector(
        selectFeature,
        (state) => state.waferTests,
    )

    export const selectIds = createSelector(
        selectWaferTestsState,
        (state) => state.ids,
    )

    export const selectEntities = createSelector(
        selectWaferTestsState,
        (state) => state.entities,
    )

    export const selectAllWaferTests = createSelector(
        selectIds, selectEntities,
        (ids, entities) => ids.map(item => entities[item]!),
    )

    export const selectOneWaferTest = (id: number) => createSelector(
        selectEntities,
        (entities) => entities[id],
    )

    export const selectFetchOneProcessing = createSelector(
        selectFeature,
        (state) => state.fetchOneProcessing,
    )

}

