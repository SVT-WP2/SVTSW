import { Observable } from 'rxjs'
import { filter, switchMap, take } from 'rxjs/operators'


export namespace ProcessingStore {

    export type ProcessingEvents<TState> = {
        processingStart$: Observable<TState>
        processingEnd$: Observable<TState>
        success$: Observable<TState>
        error$: Observable<TState>
    }

    export type EventProcessingState = {
        processing: boolean
        processingError: Error | null
    }

    export function getDefaultProcessingState(initProcessing = false): EventProcessingState {
        return {
            processing: initProcessing,
            processingError: null,
        }
    }

    export function createProcessingEvents<TState>(
        state$: Observable<TState>,
        selectEventProcessingStateFn: (state: TState) => EventProcessingState): ProcessingEvents<TState> {

        const processingStart$ = state$
            .pipe(
                filter(state => selectEventProcessingStateFn(state).processing),
            )

        const processingEnd$ = processingStart$
            .pipe(
                switchMap(() =>
                    state$
                        .pipe(
                            filter(state => !selectEventProcessingStateFn(state).processing),
                            take(1),
                        ),
                ),
            )

        const success$ = processingEnd$
            .pipe(
                filter(state => selectEventProcessingStateFn(state).processingError === null),
            )

        const error$ = processingEnd$
            .pipe(
                filter(state => selectEventProcessingStateFn(state).processingError !== null),
            )

        return {
            processingStart$,
            processingEnd$,
            success$,
            error$,
        }
    }

    export function eventProcessingStart(state: EventProcessingState): EventProcessingState {
        return {
            ...state,
            processing: true,
            processingError: null,
        }
    }

    export function eventProcessingFinish(state: EventProcessingState, error: null | Error = null): EventProcessingState {
        return {
            ...state,
            processing: false,
            processingError: error,
        }
    }

    export function hasEventProcessingError(state: EventProcessingState): boolean {
        return state.processingError !== null
    }
}
