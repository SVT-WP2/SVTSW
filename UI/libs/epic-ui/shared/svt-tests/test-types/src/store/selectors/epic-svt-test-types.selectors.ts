import { EntityState } from '@ngrx/entity'
import { createFeatureSelector, createSelector } from '@ngrx/store'
import { EpicSvtTestType, EpicSvtTestTypeConfig } from 'epic-ui/api'
import { ProcessingStore } from 'epic-ui/utils'

import { EpicSvtTestTypesStore } from '../epic-svt-test-types.store'


export namespace EpicSvtTestTypesSelectors {

    export const selectFeature = createFeatureSelector<EpicSvtTestTypesStore.State>(EpicSvtTestTypesStore.FEATURE_NAME)

    export const selectFetchAllProcessing = createSelector<any, EpicSvtTestTypesStore.State, ProcessingStore.EventProcessingState>(
        selectFeature,
        (state) => state.fetchAllProcessing,
    )

    export const selectIsAllDataFetched = createSelector(
        selectFeature,
        (state) => state.isAllDataFetched,
    )

    export const selectTestTypeEntityState = createSelector(
        selectFeature,
        (state) => state.testTypes,
    )

    export const selectIds = createSelector(
        selectTestTypeEntityState,
        (state) => state.ids,
    )

    export const selectEntities = createSelector(
        selectTestTypeEntityState,
        (state) => state.entities,
    )

    export const selectOneTestTypeById = (id: number) => createSelector<EpicSvtTestTypesStore.State,
        EntityState<EpicSvtTestType>, EpicSvtTestType>(
        selectTestTypeEntityState,
        (state) => state.entities[id]!,
    )

    export const selectAllTestTypes = createSelector(
        selectIds, selectEntities,
        (ids, entities) => ids.map(item => entities[item]!),
    )

    export const selectTestTypeConfigEntityState = createSelector<any, EpicSvtTestTypesStore.State,
        EntityState<EpicSvtTestTypeConfig>>(
        selectFeature,
        (state) => state.testTypeConfigs,
    )

    export const selectActiveTestTypeId = createSelector<any, EpicSvtTestTypesStore.State, number | null>(
        selectFeature,
        (state) => state.activeTestTypeId,
    )

    export const selectActiveTestType = createSelector<EpicSvtTestTypesStore.State, EntityState<EpicSvtTestType>,
        number | null, EpicSvtTestType | undefined>(
        selectTestTypeEntityState,
        selectActiveTestTypeId,
        ({ ids, entities }, activeTestTypeId) => activeTestTypeId ? entities[activeTestTypeId]! : undefined,
    )

    export const selectTestTypeConfigsByTypeId = createSelector<EpicSvtTestTypesStore.State,
        EntityState<EpicSvtTestTypeConfig>, EpicSvtTestTypeConfig[]>(
        selectTestTypeConfigEntityState,
        ({ ids, entities }) => ids.map(item => entities[item]!),
    )

    export const selectAllTestTypeConfigs = createSelector<EpicSvtTestTypesStore.State,
        EntityState<EpicSvtTestTypeConfig>, EpicSvtTestTypeConfig[]>(
        selectTestTypeConfigEntityState,
        ({ ids, entities }) => ids.map(item => entities[item]!),
    )

    export const selectActiveTestTypeConfigs = createSelector<EpicSvtTestTypesStore.State, EpicSvtTestTypeConfig[], number | null,
        EpicSvtTestTypeConfig[]>(
        selectAllTestTypeConfigs,
        selectActiveTestTypeId,
        (allTestTypeConfigs, activeTestTypeId) => allTestTypeConfigs.filter(item => item.testTypeId === activeTestTypeId),
    )

}

