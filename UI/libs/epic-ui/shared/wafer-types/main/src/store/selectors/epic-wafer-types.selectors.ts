import { createFeatureSelector, createSelector } from '@ngrx/store'

import { EpicWaferTypesStore } from '../epic-wafer-types.store'


export namespace EpicWaferTypesSelectors {

    export const selectFeature = createFeatureSelector<EpicWaferTypesStore.State>(EpicWaferTypesStore.FEATURE_NAME)

    export const selectFetchAllProcessing = createSelector(
        selectFeature,
        (state) => state.fetchAllProcessing,
    )

    export const selectIsAllDataFetched = createSelector(
        selectFeature,
        (state) => state.isAllDataFetched,
    )

    export const selectWaferTypesState = createSelector(
        selectFeature,
        (state) => state.waferTypes,
    )

    export const selectIds = createSelector(
        selectWaferTypesState,
        (state) => state.ids,
    )

    export const selectEntities = createSelector(
        selectWaferTypesState,
        (state) => state.entities,
    )

    export const selectAllWaferTypes = createSelector(
        selectIds, selectEntities,
        (ids, entities) => ids.map(item => entities[item]!),
    )

    export const selectOneWaferType = (id: number) => createSelector(
        selectEntities,
        (entities) => entities[id],
    )

}

