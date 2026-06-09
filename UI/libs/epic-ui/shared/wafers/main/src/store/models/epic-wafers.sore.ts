import { EpicWafer } from 'epic-ui/api'
import { EntityStore, ProcessingStore } from 'epic-ui/utils'


export namespace EpicWafersStore {

    export type State = {
        wafers: EntityStore.EntityState<EpicWafer>
        fetchAllProcessing: ProcessingStore.EventProcessingState
        fetchOneProcessing: ProcessingStore.EventProcessingState
        updateProcessing: ProcessingStore.EventProcessingState
        deleteProcessing: ProcessingStore.EventProcessingState
        isAllDataFetched: boolean
    }

    export function getDefaultState(): State {
        return {
            wafers: EntityStore.getDefaultState<EpicWafer>(),
            fetchAllProcessing: ProcessingStore.getDefaultProcessingState(),
            fetchOneProcessing: ProcessingStore.getDefaultProcessingState(),
            updateProcessing: ProcessingStore.getDefaultProcessingState(),
            deleteProcessing: ProcessingStore.getDefaultProcessingState(),
            isAllDataFetched: false,
        }
    }

    export const adapter = EntityStore.createAdapter<EpicWafer>()

    // FETCH

    export function reduceActionFetchAllRequest(state: State): State {
        return {
            ...state,
            fetchAllProcessing: ProcessingStore.eventProcessingStart(state.fetchAllProcessing),
        }
    }

    export function reduceActionFetchAllSuccess(state: State, wafersList: EpicWafer[]): State {
        return {
            ...state,
            wafers: adapter.addAll(wafersList, state.wafers),
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing),
            isAllDataFetched: true,
        }
    }

    export function reduceActionFetchAllError(state: State, error: Error): State {
        return {
            ...state,
            fetchAllProcessing: ProcessingStore.eventProcessingFinish(state.fetchAllProcessing, error),
        }
    }

    // FETCH ONE

    export function reduceActionFetchOneRequest(state: State): State {
        return {
            ...state,
            fetchOneProcessing: ProcessingStore.eventProcessingStart(state.fetchOneProcessing),
        }
    }

    export function reduceActionFetchOneSuccess(state: State, wafer: EpicWafer): State {
        return {
            ...state,
            wafers: adapter.upsertMany([wafer], state.wafers),
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

    export function reduceActionUpdateSuccess(state: State, wafer: EpicWafer): State {
        return {
            ...state,
            wafers: adapter.upsertMany([wafer], state.wafers),
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

    export function reduceActionDeleteSuccess(state: State, waferId: number): State {
        return {
            ...state,
            wafers: adapter.removeOne(waferId, state.wafers),
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
