import { createAction, props } from '@ngrx/store'
import { EpicWaferType, EpicWaferTypeCreateRequest } from 'svt-ts-types'


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
        props<{ create: EpicWaferTypeCreateRequest }>(),
    )

    export const createSuccessAction = createAction(
        ActionType.createSuccess,
        props<{ entity: EpicWaferType }>(),
    )

    export const createErrorAction = createAction(
        ActionType.createError,
        props<{ error: Error }>(),
    )

}
