import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity'
import { createReducer, on } from '@ngrx/store'
import { EpicWpProject } from 'epic-ui/api'
import { ProcessingStore } from 'epic-ui/utils'

import { EpicWpProjectsActions } from './actions'


export namespace EpicWpProjectsStore {

    export const FEATURE_NAME = 'wpProjects'

    export type State = {
        entities: EntityState<EpicWpProject>
        fetchAllProcessing: ProcessingStore.EventProcessingState
        fetchOneProcessing: ProcessingStore.EventProcessingState
        updateProcessing: ProcessingStore.EventProcessingState
        deleteProcessing: ProcessingStore.EventProcessingState
        isAllDataFetched: boolean
    }

    export const adapter: EntityAdapter<EpicWpProject> = createEntityAdapter<EpicWpProject>({
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
        on(EpicWpProjectsActions.fetchAllRequestAction, (state) => ({
            ...state,
            fetchAllProcessing: ProcessingStore.eventProcessingStart(state.fetchAllProcessing),
        })),
        on(EpicWpProjectsActions.fetchAllSuccessAction, (state, { entities }) => ({
            ...state,
            entities: adapter.setAll(entities, state.entities),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing),
            isAllDataFetched: true,
        })),
        on(EpicWpProjectsActions.fetchAllErrorAction, (state, { error }) => ({
            ...state,
            entities: adapter.setAll([], state.entities),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing, error),
            isAllDataFetched: false,
        })),
        on(EpicWpProjectsActions.createRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpProjectsActions.createSuccessAction, (state, { entity }) => ({
            ...state,
            entities: adapter.addOne(entity, state.entities),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWpProjectsActions.createErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
    )
}
