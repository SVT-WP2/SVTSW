import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity'
import { createReducer, on } from '@ngrx/store'
import { EpicWpProbeCard } from 'epic-ui/api'
import { ProcessingStore } from 'epic-ui/utils'

import { EpicWpProbeCardsActions } from './actions'


export namespace EpicWpProbeCardsStore {

    export const FEATURE_NAME = 'wpProbeCards'

    export type State = {
        entities: EntityState<EpicWpProbeCard>
        fetchAllProcessing: ProcessingStore.EventProcessingState
        fetchOneProcessing: ProcessingStore.EventProcessingState
        updateProcessing: ProcessingStore.EventProcessingState
        deleteProcessing: ProcessingStore.EventProcessingState
        isAllDataFetched: boolean
    }

    export const adapter: EntityAdapter<EpicWpProbeCard> = createEntityAdapter<EpicWpProbeCard>({
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
        on(EpicWpProbeCardsActions.fetchAllRequestAction, (state) => ({
            ...state,
            fetchAllProcessing: ProcessingStore.eventProcessingStart(state.fetchAllProcessing),
        })),
        on(EpicWpProbeCardsActions.fetchAllSuccessAction, (state, { entities }) => ({
            ...state,
            entities: adapter.setAll(entities, state.entities),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing),
            isAllDataFetched: true,
        })),
        on(EpicWpProbeCardsActions.fetchAllErrorAction, (state, { error }) => ({
            ...state,
            entities: adapter.setAll([], state.entities),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing, error),
            isAllDataFetched: false,
        })),
        on(EpicWpProbeCardsActions.createRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpProbeCardsActions.createSuccessAction, (state, { entity }) => ({
            ...state,
            entities: adapter.addOne(entity, state.entities),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpProbeCardsActions.createErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
        on(EpicWpProbeCardsActions.updateRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpProbeCardsActions.updateSuccessAction, (state, { entity }) => ({
            ...state,
            entities: adapter.updateOne({ id: entity.id, changes: entity }, state.entities),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpProbeCardsActions.updateErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
    )
}
