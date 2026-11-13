import { createAction, props } from '@ngrx/store'
import { EpicWpProbeCard } from 'epic-api-types'


export namespace EpicWpProbeCardsActions {

    export enum ActionType {
        fetchAllRequest = '[WpProbeCard] fetchAllRequest',
        fetchAllSuccess = '[WpProbeCard] fetchAllSuccess',
        fetchAllError = '[WpProbeCard] fetchAllError',
        fetchOneRequest = '[WpProbeCard] fetchOneRequest',
        fetchOneSuccess = '[WpProbeCard] fetchOneSuccess',
        fetchOneError = '[WpProbeCard] fetchOneError',
    }

    export const fetchAllRequestAction = createAction(
        ActionType.fetchAllRequest,
        props<{ force?: boolean }>(),
    )

    export const fetchAllSuccessAction = createAction(
        ActionType.fetchAllSuccess,
        props<{ entities: EpicWpProbeCard[] }>(),
    )

    export const fetchAllErrorAction = createAction(
        ActionType.fetchAllError,
        props<{ error: Error }>(),
    )

    export const fetchOneRequestAction = createAction(
        ActionType.fetchOneRequest,
    )

    export const fetchOneSuccessAction = createAction(
        ActionType.fetchOneSuccess,
        props<{ entities: EpicWpProbeCard[] }>(),
    )

    export const fetchOneErrorAction = createAction(
        ActionType.fetchOneError,
        props<{ error: Error }>(),
    )

}
