import { createAction, props } from '@ngrx/store'
import {
    EpicWpProject,
    EpicWpProjectCreate,
} from 'epic-ui/api'


export namespace EpicWpProjectsActions {

    export enum ActionType {
        fetchAllRequest = '[WpProject] fetchAllRequest',
        fetchAllSuccess = '[WpProject] fetchAllSuccess',
        fetchAllError = '[WpProject] fetchAllError',
        createRequest = '[WpProject] createRequest',
        createSuccess = '[WpProject] createSuccess',
        createError = '[WpProject] createError',
    }

    export const fetchAllRequestAction = createAction(
        ActionType.fetchAllRequest,
        props<{ force?: boolean }>(),
    )

    export const fetchAllSuccessAction = createAction(
        ActionType.fetchAllSuccess,
        props<{ entities: EpicWpProject[] }>(),
    )

    export const fetchAllErrorAction = createAction(
        ActionType.fetchAllError,
        props<{ error: Error }>(),
    )

    export const createRequestAction = createAction(
        ActionType.createRequest,
        props<{ create: EpicWpProjectCreate }>(),
    )

    export const createSuccessAction = createAction(
        ActionType.createSuccess,
        props<{ entity: EpicWpProject }>(),
    )

    export const createErrorAction = createAction(
        ActionType.createError,
        props<{ error: Error }>(),
    )

}
