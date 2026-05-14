import { createFeatureSelector, createSelector } from '@ngrx/store'

import { EpicWpMachinesStore } from '../epic-wp-machines.store'


export namespace EpicWpMachinesSelectors {

    export const selectFeature = createFeatureSelector<EpicWpMachinesStore.State>(EpicWpMachinesStore.FEATURE_NAME)

    export const selectFetchAllProcessing = createSelector(
        selectFeature,
        (state) => state.fetchAllProcessing,
    )

    export const selectIsAllDataFetched = createSelector(
        selectFeature,
        (state) => state.isAllDataFetched,
    )

    export const selectEntitiesState = createSelector(
        selectFeature,
        (state) => state.entities,
    )

    export const selectIds = createSelector(
        selectEntitiesState,
        (state) => state.ids,
    )

    export const selectEntities = createSelector(
        selectEntitiesState,
        (state) => state.entities,
    )

    export const selectAllEntitiesList = createSelector(
        selectIds, selectEntities,
        (ids, entities) => ids.map(item => entities[item]!),
    )

    export const selectOneEntityById = (id: number) => createSelector(
        selectEntities,
        (entities) => entities[id],
    )

}

