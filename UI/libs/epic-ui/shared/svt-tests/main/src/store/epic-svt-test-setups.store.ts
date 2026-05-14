import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity'
import { createReducer, on } from '@ngrx/store'
import { EpicSvtTestSetup, EpicSvtTestSetupConfig } from 'epic-ui/api'
import { ProcessingStore } from 'epic-ui/utils'

import { EpicSvtTestSetupsActions } from './actions'


export namespace EpicSvtTestSetupsStore {

    export const FEATURE_NAME = 'svtTestSetups'

    export type State = {
        testSetups: EntityState<EpicSvtTestSetup>
        testSetupConfigs: EntityState<EpicSvtTestSetupConfig>
        fetchAllProcessing: ProcessingStore.EventProcessingState
        updateProcessing: ProcessingStore.EventProcessingState
        createProcessing: ProcessingStore.EventProcessingState
        createConfigProcessing: ProcessingStore.EventProcessingState
        deleteProcessing: ProcessingStore.EventProcessingState
        isAllDataFetched: boolean
    }

    export const adapter: EntityAdapter<EpicSvtTestSetup> = createEntityAdapter<EpicSvtTestSetup>({
        selectId: (entity) => entity.id,
    })

    export const adapterConfigs: EntityAdapter<EpicSvtTestSetupConfig> = createEntityAdapter<EpicSvtTestSetupConfig>({
        selectId: (entity) => entity.id,
        sortComparer: (left, right) => left.name.toLowerCase().localeCompare(right.name.toLowerCase()),
    })

    export const defaultState: State = {
        testSetups: adapter.getInitialState(),
        testSetupConfigs: adapterConfigs.getInitialState(),
        fetchAllProcessing: ProcessingStore.getDefaultProcessingState(),
        updateProcessing: ProcessingStore.getDefaultProcessingState(),
        createProcessing: ProcessingStore.getDefaultProcessingState(),
        createConfigProcessing: ProcessingStore.getDefaultProcessingState(),
        deleteProcessing: ProcessingStore.getDefaultProcessingState(),
        isAllDataFetched: false,
    }

    export const reducer = createReducer(
        defaultState,
        on(EpicSvtTestSetupsActions.fetchAllRequestAction, (state) => ({
            ...state,
            fetchAllProcessing: ProcessingStore.eventProcessingStart(state.fetchAllProcessing),
        })),
        on(EpicSvtTestSetupsActions.fetchAllSuccessAction, (state, { testSetups, testSetupConfigs }) => ({
            ...state,
            testSetups: adapter.setAll(testSetups, state.testSetups),
            testSetupConfigs: adapterConfigs.setAll(testSetupConfigs, state.testSetupConfigs),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing),
            isAllDataFetched: true,
        })),
        on(EpicSvtTestSetupsActions.fetchAllErrorAction, (state, { error }) => ({
            ...state,
            testSetups: adapter.setAll([], state.testSetups),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing, error),
            isAllDataFetched: false,
        })),
        on(EpicSvtTestSetupsActions.createRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicSvtTestSetupsActions.createSuccessAction, (state, { testSetup, testSetupConfig }) => ({
            ...state,
            testSetups: adapter.addOne(testSetup, state.testSetups),
            testSetupConfigs: adapterConfigs.addOne(testSetupConfig, state.testSetupConfigs),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicSvtTestSetupsActions.createErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
        on(EpicSvtTestSetupsActions.updateRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicSvtTestSetupsActions.updateSuccessAction, (state, { entity }) => ({
            ...state,
            testSetups: adapter.updateOne({ id: entity.id, changes: entity }, state.testSetups),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicSvtTestSetupsActions.updateErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
        on(EpicSvtTestSetupsActions.createConfigRequestAction, (state) => ({
            ...state,
            createConfigProcessing: ProcessingStore.eventProcessingFinish(state.createConfigProcessing),
        })),
        on(EpicSvtTestSetupsActions.createConfigSuccessAction, (state, { entity }) => ({
            ...state,
            testSetupConfigs: adapterConfigs.addOne(entity, state.testSetupConfigs),
            createConfigProcessing: ProcessingStore.eventProcessingFinish(state.createConfigProcessing),
        })),
        on(EpicSvtTestSetupsActions.createConfigErrorAction, (state, { error }) => ({
            ...state,
            createConfigProcessing: ProcessingStore.eventProcessingFinish(state.createConfigProcessing, error),
        })),
    )
}
