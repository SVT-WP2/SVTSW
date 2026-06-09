import { createAction, emptyProps, props } from '@ngrx/store'
import {
    EpicSvtTestSetup,
    EpicSvtTestSetupConfig,
    EpicSvtTestSetupConfigCreate,
    EpicSvtTestSetupCreate,
    EpicSvtTestSetupUpdate,
} from 'epic-ui/api'


export namespace EpicSvtTestSetupsActions {

    export enum ActionType {
        fetchAllRequest = '[SvtTestSetups] fetchAllRequest',
        fetchAllSuccess = '[SvtTestSetups] fetchAllSuccess',
        fetchAllError = '[SvtTestSetups] fetchAllError',
        createRequest = '[SvtTestSetups] createRequest',
        createSuccess = '[SvtTestSetups] createSuccess',
        createError = '[SvtTestSetups] createError',
        updateRequest = '[SvtTestSetups] updateRequest',
        updateSuccess = '[SvtTestSetups] updateSuccess',
        updateError = '[SvtTestSetups] updateError',
        createConfigRequest = '[SvtTestSetups] createConfigRequest',
        createConfigSuccess = '[SvtTestSetups] createConfigSuccess',
        createConfigError = '[SvtTestSetups] createConfigError',
        leave = '[SvtTestSetups] leave',
    }

    export const fetchAllRequestAction = createAction(
        ActionType.fetchAllRequest,
        props<{ force?: boolean }>(),
    )

    export const fetchAllSuccessAction = createAction(
        ActionType.fetchAllSuccess,
        props<{
            testSetups: EpicSvtTestSetup[]
            testSetupConfigs: EpicSvtTestSetupConfig[]
        }>(),
    )

    export const fetchAllErrorAction = createAction(
        ActionType.fetchAllError,
        props<{ error: Error }>(),
    )

    export const createRequestAction = createAction(
        ActionType.createRequest,
        props<{ create: EpicSvtTestSetupCreate }>(),
    )

    export type CreateSuccessActionPayload = {
        testSetup: EpicSvtTestSetup
        testSetupConfig: EpicSvtTestSetupConfig
    }

    export const createSuccessAction = createAction(
        ActionType.createSuccess,
        props<CreateSuccessActionPayload>(),
    )

    export const createErrorAction = createAction(
        ActionType.createError,
        props<{ error: Error }>(),
    )

    export const updateRequestAction = createAction(
        ActionType.updateRequest,
        props<{ id: number; update: EpicSvtTestSetupUpdate }>(),
    )

    export const updateSuccessAction = createAction(
        ActionType.updateSuccess,
        props<{ entity: EpicSvtTestSetup }>(),
    )

    export const updateErrorAction = createAction(
        ActionType.updateError,
        props<{ error: Error }>(),
    )

    export const createConfigRequestAction = createAction(
        ActionType.createConfigRequest,
        props<{ create: EpicSvtTestSetupConfigCreate }>(),
    )

    export const createConfigSuccessAction = createAction(
        ActionType.createConfigSuccess,
        props<{ entity: EpicSvtTestSetupConfig }>(),
    )

    export const createConfigErrorAction = createAction(
        ActionType.createConfigError,
        props<{ error: Error }>(),
    )

    export const leaveAction = createAction(
        ActionType.leave,
        emptyProps,
    )

}
