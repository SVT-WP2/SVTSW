import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity'
import { createReducer, on } from '@ngrx/store'
import { EpicWpMachine } from 'epic-ui/api'
import { ProcessingStore } from 'epic-ui/utils'

import { EpicWpMachinesActions } from './actions'


export namespace EpicWpMachinesStore {

    export const FEATURE_NAME = 'wpMachines'

    export type State = {
        entities: EntityState<EpicWpMachine>
        fetchAllProcessing: ProcessingStore.EventProcessingState
        fetchOneProcessing: ProcessingStore.EventProcessingState
        updateProcessing: ProcessingStore.EventProcessingState
        deleteProcessing: ProcessingStore.EventProcessingState
        isAllDataFetched: boolean
    }

    export const adapter: EntityAdapter<EpicWpMachine> = createEntityAdapter<EpicWpMachine>({
        selectId: (entity) => entity.id,
    })

    export const defaultState: State = {
        entities: adapter.getInitialState(),
        fetchAllProcessing: ProcessingStore.getDefaultProcessingState(),
        fetchOneProcessing: ProcessingStore.getDefaultProcessingState(),
        updateProcessing: ProcessingStore.getDefaultProcessingState(),
        deleteProcessing: ProcessingStore.getDefaultProcessingState(),
        isAllDataFetched: false,
    }

    export const reducer = createReducer(
        defaultState,
        on(EpicWpMachinesActions.fetchAllRequestAction, (state) => ({
            ...state,
            fetchAllProcessing: ProcessingStore.eventProcessingStart(state.fetchAllProcessing),
        })),
        on(EpicWpMachinesActions.fetchAllSuccessAction, (state, { entities }) => ({
            ...state,
            entities: adapter.setAll(entities, state.entities),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing),
            isAllDataFetched: true,
        })),
        on(EpicWpMachinesActions.fetchAllErrorAction, (state, { error }) => ({
            ...state,
            entities: adapter.setAll([], state.entities),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing, error),
            isAllDataFetched: false,
        })),
        on(EpicWpMachinesActions.createRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpMachinesActions.createSuccessAction, (state, { entity }) => ({
            ...state,
            entities: adapter.addOne(entity, state.entities),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpMachinesActions.createErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
        on(EpicWpMachinesActions.updateRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpMachinesActions.updateSuccessAction, (state, { entity }) => ({
            ...state,
            entities: adapter.updateOne({ id: entity.id, changes: entity }, state.entities),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpMachinesActions.updateErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
        on(EpicWpMachinesActions.updateInstalledProbeCardRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpMachinesActions.updateInstalledProbeCardSuccessAction, (state, { entity }) => ({
            ...state,
            entities: adapter.updateOne({ id: entity.id, changes: entity }, state.entities),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpMachinesActions.updateInstalledProbeCardErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
        on(EpicWpMachinesActions.updateLoadedWaferRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpMachinesActions.updateLoadedWaferSuccessAction, (state, { entity }) => ({
            ...state,
            entities: adapter.updateOne({ id: entity.id, changes: entity }, state.entities),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpMachinesActions.updateLoadedWaferErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
    )
}
