import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity'
import { createReducer, on } from '@ngrx/store'
import { ProcessingStore } from 'epic-ui/utils'
import { EpicWpProbeCard } from 'svt-ts-types'

import { EpicWpProbeCardsActions } from './actions'


export namespace EpicWpProbeCardsStore {

    export const FEATURE_NAME = 'wpProbeCards'

    export type State = {
        entities: EntityState<EpicWpProbeCard>
        fetchAllProcessing: ProcessingStore.EventProcessingState
        fetchOneProcessing: ProcessingStore.EventProcessingState
        isAllDataFetched: boolean
    }

    export const adapter: EntityAdapter<EpicWpProbeCard> = createEntityAdapter<EpicWpProbeCard>({
        selectId: (entity) => entity.id,
    })

    export const defaultState: State = {
        entities: adapter.getInitialState(),
        fetchAllProcessing: ProcessingStore.getDefaultProcessingState(),
        fetchOneProcessing: ProcessingStore.getDefaultProcessingState(),
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
    )
}
