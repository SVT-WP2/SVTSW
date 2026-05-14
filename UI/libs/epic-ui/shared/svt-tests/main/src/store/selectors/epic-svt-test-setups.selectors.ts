
import { EntityState } from '@ngrx/entity'
import { createFeatureSelector, createSelector } from '@ngrx/store'
import { EpicSvtTestSetup, EpicSvtTestSetupConfig } from 'epic-ui/api'
import { ProcessingStore } from 'epic-ui/utils'

import { EpicSvtTestSetupsStore } from '../epic-svt-test-setups.store'


export namespace EpicSvtTestSetupsSelectors {

    export const selectFeature = createFeatureSelector<EpicSvtTestSetupsStore.State>(EpicSvtTestSetupsStore.FEATURE_NAME)

    export const selectFetchAllProcessing = createSelector<any, EpicSvtTestSetupsStore.State, ProcessingStore.EventProcessingState>(
        selectFeature,
        (state) => state.fetchAllProcessing,
    )

    export const selectIsAllDataFetched = createSelector(
        selectFeature,
        (state) => state.isAllDataFetched,
    )

    export const selectTestSetupEntityState = createSelector(
        selectFeature,
        (state) => state.testSetups,
    )

    export const selectIds = createSelector(
        selectTestSetupEntityState,
        (state) => state.ids,
    )

    export const selectEntities = createSelector(
        selectTestSetupEntityState,
        (state) => state.entities,
    )

    export const selectOneTestSetupById = (id: number) => createSelector<EpicSvtTestSetupsStore.State,
        EntityState<EpicSvtTestSetup>, EpicSvtTestSetup>(
        selectTestSetupEntityState,
        (state) => state.entities[id]!,
    )

    export const selectAllTestSetups = createSelector(
        selectIds, selectEntities,
        (ids, entities) => ids.map(item => entities[item]!),
    )

    export const selectTestSetupConfigEntityState = createSelector<any, EpicSvtTestSetupsStore.State, 
        EntityState<EpicSvtTestSetupConfig>>(
        selectFeature,
        (state) => state.testSetupConfigs,
    )

    export const selectAllTestSetupConfigs = createSelector<EpicSvtTestSetupsStore.State,
        EntityState<EpicSvtTestSetupConfig>, EpicSvtTestSetupConfig[]>(
        selectTestSetupConfigEntityState,
        ({ ids, entities }) => ids.map(item => entities[item]!),
    )

    export const selectTestSetupConfigsBySetupId = createSelector<EpicSvtTestSetupsStore.State,
        EntityState<EpicSvtTestSetupConfig>, EpicSvtTestSetupConfig[]>(
        selectTestSetupConfigEntityState,
        ({ ids, entities }) => ids.map(item => entities[item]!),
    )

}

