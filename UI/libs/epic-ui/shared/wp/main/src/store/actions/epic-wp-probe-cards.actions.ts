import { createAction, props } from '@ngrx/store'
import {
    EpicWpProbeCard,
    EpicWpProbeCardCreate,
    EpicWpProbeCardUpdate,
} from 'epic-ui/api'


export namespace EpicWpProbeCardsActions {

    export enum ActionType {
        fetchAllRequest = '[WpProbeCard] fetchAllRequest',
        fetchAllSuccess = '[WpProbeCard] fetchAllSuccess',
        fetchAllError = '[WpProbeCard] fetchAllError',
        fetchOneRequest = '[WpProbeCard] fetchOneRequest',
        fetchOneSuccess = '[WpProbeCard] fetchOneSuccess',
        fetchOneError = '[WpProbeCard] fetchOneError',
        createRequest = '[WpProbeCard] createRequest',
        createSuccess = '[WpProbeCard] createSuccess',
        createError = '[WpProbeCard] createError',
        updateRequest = '[WpProbeCard] updateRequest',
        updateSuccess = '[WpProbeCard] updateSuccess',
        updateError = '[WpProbeCard] updateError',
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

    export const createRequestAction = createAction(
        ActionType.createRequest,
        props<{ create: EpicWpProbeCardCreate }>(),
    )

    export const createSuccessAction = createAction(
        ActionType.createSuccess,
        props<{ entity: EpicWpProbeCard }>(),
    )

    export const createErrorAction = createAction(
        ActionType.createError,
        props<{ error: Error }>(),
    )

    export const updateRequestAction = createAction(
        ActionType.updateRequest,
        props<{ id: number; update: Partial<EpicWpProbeCardUpdate> }>(),
    )

    export const updateSuccessAction = createAction(
        ActionType.updateSuccess,
        props<{ entity: EpicWpProbeCard }>(),
    )

    export const updateErrorAction = createAction(
        ActionType.updateError,
        props<{ error: Error }>(),
    )

}
