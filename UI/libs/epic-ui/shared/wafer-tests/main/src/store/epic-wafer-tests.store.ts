import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity'
import { createReducer, on } from '@ngrx/store'
import { ProcessingStore } from 'epic-ui/utils'

import { EpicWaferTestExtended } from '../models'

import { EpicWaferTestsActions } from './actions'


export namespace EpicWaferTestsStore {

    export const FEATURE_NAME = 'waferTests'

    export type State = {
        waferTests: EntityState<EpicWaferTestExtended>
        fetchAllProcessing: ProcessingStore.EventProcessingState
        fetchOneProcessing: ProcessingStore.EventProcessingState
        updateProcessing: ProcessingStore.EventProcessingState
        deleteProcessing: ProcessingStore.EventProcessingState
        isAllDataFetched: boolean
    }

    export const adapter: EntityAdapter<EpicWaferTestExtended> = createEntityAdapter<EpicWaferTestExtended>({
        selectId: (entity) => entity.id,
    })

    export const defaultState: State = {
        waferTests: adapter.getInitialState(),
        fetchAllProcessing: ProcessingStore.getDefaultProcessingState(),
        fetchOneProcessing: ProcessingStore.getDefaultProcessingState(),
        updateProcessing: ProcessingStore.getDefaultProcessingState(),
        deleteProcessing: ProcessingStore.getDefaultProcessingState(),
        isAllDataFetched: false,
    }

    export const reducer = createReducer(
        defaultState,
        //
        // FETCH ALL
        //
        on(EpicWaferTestsActions.fetchAllRequestAction, (state) => ({
            ...state,
            fetchAllProcessing: ProcessingStore.eventProcessingStart(state.fetchAllProcessing),
        })),
        on(EpicWaferTestsActions.fetchAllSuccessAction, (state, { entities }) => ({
            ...state,
            waferTests: adapter.setAll(entities, state.waferTests),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing),
            isAllDataFetched: true,
        })),
        on(EpicWaferTestsActions.fetchAllErrorAction, (state, { error }) => ({
            ...state,
            waferTests: adapter.setAll([], state.waferTests),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing, error),
            isAllDataFetched: false,
        })),
        //
        // FETCH ONE
        //
        on(EpicWaferTestsActions.fetchOneRequestAction, (state) => ({
            ...state,
            fetchOneProcessing: ProcessingStore.eventProcessingStart(state.fetchOneProcessing),
        })),
        on(EpicWaferTestsActions.fetchOneSuccessAction, (state, { entity }) => ({
            ...state,
            waferTests: adapter.upsertOne(entity, state.waferTests),
            fetchOneProcessing: ProcessingStore.eventProcessingFinish(state.fetchOneProcessing),
        })),
        on(EpicWaferTestsActions.fetchOneErrorAction, (state, { error }) => ({
            ...state,
            fetchOneProcessing: ProcessingStore.eventProcessingFinish(state.fetchOneProcessing, error),
        })),
        //
        // CREATE
        //
        on(EpicWaferTestsActions.createRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWaferTestsActions.createSuccessAction, (state, { entity }) => ({
            ...state,
            waferTests: adapter.addOne(entity, state.waferTests),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWaferTestsActions.createErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
        //
        // UPDATE
        //
        on(EpicWaferTestsActions.updateRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWaferTestsActions.updateSuccessAction, (state, { entity }) => ({
            ...state,
            waferTests: adapter.updateOne({ id: entity.id, changes: entity }, state.waferTests),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWaferTestsActions.updateErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
    )
}
