import { EpicAsic } from 'epic-ui/api'
import { EntityStore, ProcessingStore } from 'epic-ui/utils'


export namespace EpicAsicsStore {

    export type State = {
        asics: EntityStore.EntityState<EpicAsic>
        waferId: number | undefined
        fetchAllProcessing: ProcessingStore.EventProcessingState
        fetchOneProcessing: ProcessingStore.EventProcessingState
        updateProcessing: ProcessingStore.EventProcessingState
        deleteProcessing: ProcessingStore.EventProcessingState
        isAllDataFetched: boolean
        allAsicsForWaferFetched: Record<number, boolean>
    }

    export function getDefaultState(): State {
        return {
            waferId: undefined,
            asics: EntityStore.getDefaultState<EpicAsic>(),
            fetchAllProcessing: ProcessingStore.getDefaultProcessingState(),
            fetchOneProcessing: ProcessingStore.getDefaultProcessingState(),
            updateProcessing: ProcessingStore.getDefaultProcessingState(),
            deleteProcessing: ProcessingStore.getDefaultProcessingState(),
            isAllDataFetched: false,
            allAsicsForWaferFetched: {},
        }
    }

    export const adapter = EntityStore.createAdapter<EpicAsic>()

    // FETCH

    export function reduceActionFetchAllRequest(state: State, waferId?: number): State {
        return {
            ...state,
            waferId,
            asics: adapter.addAll([], state.asics),
            fetchAllProcessing: ProcessingStore.eventProcessingStart(state.fetchAllProcessing),
            isAllDataFetched: false,
            allAsicsForWaferFetched: {},
        }
    }

    export function reduceActionFetchAllSuccess(state: State, entities: EpicAsic[], waferId?: number): State {
        return {
            ...state,
            asics: adapter.addAll(entities, state.asics),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing),
            isAllDataFetched: waferId ? state.isAllDataFetched : true,
            allAsicsForWaferFetched: !waferId
                ? state.allAsicsForWaferFetched :
                {
                    ...state.allAsicsForWaferFetched,
                    [waferId]: true,
                },
        }
    }

    export function reduceActionFetchAllError(state: State, error: Error): State {
        return {
            ...state,
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing, error),
        }
    }

    // FETCH ONE

    export function reduceActionFetchOneRequest(state: State, waferId?: number): State {
        return {
            ...state,
            waferId,
            fetchOneProcessing: ProcessingStore.eventProcessingStart(state.fetchOneProcessing),
            isAllDataFetched: false,
        }
    }

    export function reduceActionFetchOneSuccess(state: State, entity: EpicAsic): State {
        return {
            ...state,
            asics: adapter.upsertMany([entity], state.asics),
            fetchOneProcessing: ProcessingStore.eventProcessingFinish(state.fetchOneProcessing),
        }
    }

    export function reduceActionFetchOneError(state: State, error: Error): State {
        return {
            ...state,
            fetchOneProcessing: ProcessingStore.eventProcessingFinish(state.fetchOneProcessing, error),
        }
    }

    // UPDATE

    export function reduceActionUpdateRequest(state: State): State {
        return {
            ...state,
            updateProcessing: ProcessingStore.eventProcessingStart(state.updateProcessing),
        }
    }

    export function reduceActionUpdateSuccess(state: State, entity: EpicAsic): State {
        return {
            ...state,
            asics: adapter.upsertMany([entity], state.asics),
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing),
        }
    }

    export function reduceActionUpdateError(state: State, error: Error): State {
        return {
            ...state,
            updateProcessing: ProcessingStore.eventProcessingFinish(state.updateProcessing, error),
        }
    }

    // DELETE

    export function reduceActionDeleteRequest(state: State): State {
        return {
            ...state,
            deleteProcessing: ProcessingStore.eventProcessingStart(state.deleteProcessing),
        }
    }

    export function reduceActionDeleteSuccess(state: State, entityId: number): State {
        return {
            ...state,
            asics: adapter.removeOne(entityId, state.asics),
            deleteProcessing: ProcessingStore.eventProcessingFinish(state.deleteProcessing),
        }
    }

    export function reduceActionDeleteError(state: State, error: Error): State {
        return {
            ...state,
            deleteProcessing: ProcessingStore.eventProcessingFinish(state.deleteProcessing, error),
        }
    }

}
