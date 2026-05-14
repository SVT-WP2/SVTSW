import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity'
import { createReducer, on } from '@ngrx/store'
import { EpicSvtTestType, EpicSvtTestTypeConfig } from 'epic-ui/api'
import { ProcessingStore } from 'epic-ui/utils'

import { EpicSvtTestTypesActions } from './actions'


export namespace EpicSvtTestTypesStore {

    export const FEATURE_NAME = 'svtTestTypes'

    export type State = {
        testTypes: EntityState<EpicSvtTestType>
        testTypeConfigs: EntityState<EpicSvtTestTypeConfig>
        fetchAllProcessing: ProcessingStore.EventProcessingState
        updateProcessing: ProcessingStore.EventProcessingState
        createProcessing: ProcessingStore.EventProcessingState
        createConfigProcessing: ProcessingStore.EventProcessingState
        deleteProcessing: ProcessingStore.EventProcessingState
        isAllDataFetched: boolean
        activeTestTypeId: number | null
    }

    export const adapter: EntityAdapter<EpicSvtTestType> = createEntityAdapter<EpicSvtTestType>({
        selectId: (entity) => entity.id,
    })

    export const adapterConfigs: EntityAdapter<EpicSvtTestTypeConfig> = createEntityAdapter<EpicSvtTestTypeConfig>({
        selectId: (entity) => entity.id,
        sortComparer: (left, right) => left.name.toLowerCase().localeCompare(right.name.toLowerCase()),
    })

    export const defaultState: State = {
        testTypes: adapter.getInitialState(),
        testTypeConfigs: adapterConfigs.getInitialState(),
        fetchAllProcessing: ProcessingStore.getDefaultProcessingState(),
        updateProcessing: ProcessingStore.getDefaultProcessingState(),
        createProcessing: ProcessingStore.getDefaultProcessingState(),
        createConfigProcessing: ProcessingStore.getDefaultProcessingState(),
        deleteProcessing: ProcessingStore.getDefaultProcessingState(),
        isAllDataFetched: false,
        activeTestTypeId: null,
    }

    export const reducer = createReducer(
        defaultState,
        on(EpicSvtTestTypesActions.fetchAllRequestAction, (state) => ({
            ...state,
            fetchAllProcessing: ProcessingStore.eventProcessingStart(state.fetchAllProcessing),
        })),
        on(EpicSvtTestTypesActions.fetchAllSuccessAction, (state, { testTypes, testTypeConfigs }) => ({
            ...state,
            testTypes: adapter.setAll(testTypes, state.testTypes),
            testTypeConfigs: adapterConfigs.setAll(testTypeConfigs, state.testTypeConfigs),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing),
            isAllDataFetched: true,
        })),
        on(EpicSvtTestTypesActions.fetchAllErrorAction, (state, { error }) => ({
            ...state,
            testTypes: adapter.setAll([], state.testTypes),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing, error),
            isAllDataFetched: false,
        })),
        on(EpicSvtTestTypesActions.setActiveTestTypeAction, (state, { testTypeId }) => ({
            ...state,
            activeTestTypeId: testTypeId,
        })),
        on(EpicSvtTestTypesActions.createRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicSvtTestTypesActions.createSuccessAction, (state, { testType, testTypeConfig }) => ({
            ...state,
            testTypes: adapter.addOne(testType, state.testTypes),
            testTypeConfigs: adapterConfigs.addOne(testTypeConfig, state.testTypeConfigs),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicSvtTestTypesActions.createErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
        on(EpicSvtTestTypesActions.updateRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicSvtTestTypesActions.updateSuccessAction, (state, { entity }) => ({
            ...state,
            testTypes: adapter.updateOne({ id: entity.id, changes: entity }, state.testTypes),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicSvtTestTypesActions.updateErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
        on(EpicSvtTestTypesActions.createConfigRequestAction, (state) => ({
            ...state,
            createConfigProcessing: ProcessingStore.eventProcessingFinish(state.createConfigProcessing),
        })),
        on(EpicSvtTestTypesActions.createConfigSuccessAction, (state, { entity }) => ({
            ...state,
            testTypeConfigs: adapterConfigs.addOne(entity, state.testTypeConfigs),
            createConfigProcessing: ProcessingStore.eventProcessingFinish(state.createConfigProcessing),
        })),
        on(EpicSvtTestTypesActions.createConfigErrorAction, (state, { error }) => ({
            ...state,
            createConfigProcessing: ProcessingStore.eventProcessingFinish(state.createConfigProcessing, error),
        })),
    )
}

