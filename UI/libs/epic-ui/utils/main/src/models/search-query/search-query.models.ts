import { ProcessingStore } from '../store'


export namespace SearchQuery {

    export type DataState<TData> = {
        data: TData | null
        loadingProcessing: ProcessingStore.EventProcessingState
    }

    export const DEFAULT_RENDER_DATA: DataState<any> = {
        data: null,
        loadingProcessing: ProcessingStore.getDefaultProcessingState(),
    }

}
