import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity'
import { createReducer, on } from '@ngrx/store'
import { ProcessingStore } from 'epic-ui/utils'
import { EpicWaferType } from 'svt-ts-types'

import { EpicWaferTypesActions } from './actions'


export namespace EpicWaferTypesStore {

    export const FEATURE_NAME = 'waferTypes'

    export type State = {
        waferTypes: EntityState<EpicWaferType>
        fetchAllProcessing: ProcessingStore.EventProcessingState
        fetchOneProcessing: ProcessingStore.EventProcessingState
        updateProcessing: ProcessingStore.EventProcessingState
        deleteProcessing: ProcessingStore.EventProcessingState
        isAllDataFetched: boolean
    }

    export const adapter: EntityAdapter<EpicWaferType> = createEntityAdapter<EpicWaferType>({
        selectId: (entity) => entity.id,
    })

    export const defaultState: State = {
        waferTypes: adapter.getInitialState(),
        fetchAllProcessing: ProcessingStore.getDefaultProcessingState(),
        fetchOneProcessing: ProcessingStore.getDefaultProcessingState(),
        updateProcessing: ProcessingStore.getDefaultProcessingState(),
        deleteProcessing: ProcessingStore.getDefaultProcessingState(),
        isAllDataFetched: false,
    }

    export const reducer = createReducer(
        defaultState,
        on(EpicWaferTypesActions.fetchAllRequestAction, (state) => ({
            ...state,
            fetchAllProcessing: ProcessingStore.eventProcessingStart(state.fetchAllProcessing),
        })),
        on(EpicWaferTypesActions.fetchAllSuccessAction, (state, { entities }) => ({
            ...state,
            waferTypes: adapter.setAll(entities, state.waferTypes),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing),
            isAllDataFetched: true,
        })),
        on(EpicWaferTypesActions.fetchAllErrorAction, (state, { error }) => ({
            ...state,
            waferTypes: adapter.setAll([], state.waferTypes),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing, error),
            isAllDataFetched: false,
        })),
        on(EpicWaferTypesActions.createRequestAction, (state) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWaferTypesActions.createSuccessAction, (state, { entity }) => ({
            ...state,
            waferTypes: adapter.addOne(entity, state.waferTypes),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        })),
        on(EpicWaferTypesActions.createErrorAction, (state, { error }) => ({
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        })),
    )
}
