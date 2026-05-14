import { BehaviorSubject, Observable, Subject } from 'rxjs'


export type StoreCommonErrorPayload<TError = unknown> = {
    error: TError
}

export abstract class BaseStore<TState> {

    readonly state$: Observable<TState>

    protected readonly _defaultState: TState
    protected readonly _state$: BehaviorSubject<TState>
    protected disconnected$: Subject<void> | null = new Subject<void>()

    protected constructor(
        defaultState: TState,
    ) {
        this._defaultState = defaultState
        this._state$ = new BehaviorSubject<TState>(this._defaultState)
        this.state$ = this._state$.asObservable()
    }

    get state(): TState {
        return this._state$.getValue()
    }

    resetState(): void {
        this.updateState(this._defaultState)
    }

    connect(): void {
        if(!this.disconnected$) {
            this.disconnected$ = new Subject<void>()
        }
    }

    disconnect(): void {
        this.disconnected$?.next()
    }

    protected updateState(state: Partial<TState>): TState {

        const newValue = {
            ...this.state,
            ...state,
        } as TState

        this._state$.next(newValue)

        return newValue
    }

}
