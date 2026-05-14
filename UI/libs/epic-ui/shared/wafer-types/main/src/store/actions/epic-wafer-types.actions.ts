import { createAction, props } from '@ngrx/store'
import { EpicWaferType, EpicWaferTypeCreate, EpicWaferTypeUpdate } from 'epic-ui/api'


export namespace EpicWaferTypesActions {

    export enum ActionType {
        fetchAllRequest = '[WaferTypes] fetchAllRequest',
        fetchAllSuccess = '[WaferTypes] fetchAllSuccess',
        fetchAllError = '[WaferTypes] fetchAllError',
        fetchOneRequest = '[WaferTypes] fetchOneRequest',
        fetchOneSuccess = '[WaferTypes] fetchOneSuccess',
        fetchOneError = '[WaferTypes] fetchOneError',
        createRequest = '[WaferTypes] createRequest',
        createSuccess = '[WaferTypes] createSuccess',
        createError = '[WaferTypes] createError',
        updateRequest = '[WaferTypes] updateRequest',
        updateSuccess = '[WaferTypes] updateSuccess',
        updateError = '[WaferTypes] updateError',
    }

    export const fetchAllRequestAction = createAction(
        ActionType.fetchAllRequest,
        props<{ force?: boolean }>(),
    )

    export const fetchAllSuccessAction = createAction(
        ActionType.fetchAllSuccess,
        props<{ entities: EpicWaferType[] }>(),
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
        props<{ entities: EpicWaferType[] }>(),
    )

    export const fetchOneErrorAction = createAction(
        ActionType.fetchOneError,
        props<{ error: Error }>(),
    )

    export const createRequestAction = createAction(
        ActionType.createRequest,
        props<{ create: EpicWaferTypeCreate }>(),
    )

    export const createSuccessAction = createAction(
        ActionType.createSuccess,
        props<{ entity: EpicWaferType }>(),
    )

    export const createErrorAction = createAction(
        ActionType.createError,
        props<{ error: Error }>(),
    )

    export const updateRequestAction = createAction(
        ActionType.updateRequest,
        props<{ id: number; update: Partial<EpicWaferTypeUpdate> }>(),
    )

    export const updateSuccessAction = createAction(
        ActionType.updateSuccess,
        props<{ entity: EpicWaferType }>(),
    )

    export const updateErrorAction = createAction(
        ActionType.updateError,
        props<{ error: Error }>(),
    )

}
