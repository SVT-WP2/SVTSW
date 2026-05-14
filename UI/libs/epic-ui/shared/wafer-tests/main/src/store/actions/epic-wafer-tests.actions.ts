import { createAction, props } from '@ngrx/store'
import { EpicWaferTestCreate, EpicWaferTestUpdate } from 'epic-ui/api'

import { EpicWaferTestExtended } from '../../models'


export namespace EpicWaferTestsActions {

    export enum ActionType {
        fetchAllRequest = '[WaferTests] fetchAllRequest',
        fetchAllSuccess = '[WaferTests] fetchAllSuccess',
        fetchAllError = '[WaferTests] fetchAllError',
        fetchOneRequest = '[WaferTests] fetchOneRequest',
        fetchOneSuccess = '[WaferTests] fetchOneSuccess',
        fetchOneError = '[WaferTests] fetchOneError',
        createRequest = '[WaferTests] createRequest',
        createSuccess = '[WaferTests] createSuccess',
        createError = '[WaferTests] createError',
        updateRequest = '[WaferTests] updateRequest',
        updateSuccess = '[WaferTests] updateSuccess',
        updateError = '[WaferTests] updateError',
    }

    export const fetchAllRequestAction = createAction(
        ActionType.fetchAllRequest,
        props<{ force?: boolean }>(),
    )

    export const fetchAllSuccessAction = createAction(
        ActionType.fetchAllSuccess,
        props<{ entities: EpicWaferTestExtended[] }>(),
    )

    export const fetchAllErrorAction = createAction(
        ActionType.fetchAllError,
        props<{ error: Error }>(),
    )

    export const fetchOneRequestAction = createAction(
        ActionType.fetchOneRequest,
        props<{ entityId: number; force?: boolean }>(),
    )

    export const fetchOneSuccessAction = createAction(
        ActionType.fetchOneSuccess,
        props<{ entity: EpicWaferTestExtended }>(),
    )

    export const fetchOneErrorAction = createAction(
        ActionType.fetchOneError,
        props<{ error: Error }>(),
    )

    export const createRequestAction = createAction(
        ActionType.createRequest,
        props<{ create: EpicWaferTestCreate }>(),
    )

    export const createSuccessAction = createAction(
        ActionType.createSuccess,
        props<{ entity: EpicWaferTestExtended }>(),
    )

    export const createErrorAction = createAction(
        ActionType.createError,
        props<{ error: Error }>(),
    )

    export const updateRequestAction = createAction(
        ActionType.updateRequest,
        props<{ id: number; update: Partial<EpicWaferTestUpdate> }>(),
    )

    export const updateSuccessAction = createAction(
        ActionType.updateSuccess,
        props<{ entity: EpicWaferTestExtended }>(),
    )

    export const updateErrorAction = createAction(
        ActionType.updateError,
        props<{ error: Error }>(),
    )

}
