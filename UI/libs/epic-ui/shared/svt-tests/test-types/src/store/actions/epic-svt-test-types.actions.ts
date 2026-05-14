import { createAction, emptyProps, props } from '@ngrx/store'
import {
    EpicSvtTestType,
    EpicSvtTestTypeConfig,
    EpicSvtTestTypeConfigCreate,
    EpicSvtTestTypeCreate,
    EpicSvtTestTypeUpdate,
} from 'epic-ui/api'


export namespace EpicSvtTestTypesActions {

    export enum ActionType {
        fetchAllRequest = '[SvtTestTypes] fetchAllRequest',
        fetchAllSuccess = '[SvtTestTypes] fetchAllSuccess',
        fetchAllError = '[SvtTestTypes] fetchAllError',
        setActiveTestType = '[SvtTestTypes] setActiveTestType',
        createRequest = '[SvtTestTypes] createRequest',
        createSuccess = '[SvtTestTypes] createSuccess',
        createError = '[SvtTestTypes] createError',
        updateRequest = '[SvtTestTypes] updateRequest',
        updateSuccess = '[SvtTestTypes] updateSuccess',
        updateError = '[SvtTestTypes] updateError',
        createConfigRequest = '[SvtTestTypes] createConfigRequest',
        createConfigSuccess = '[SvtTestTypes] createConfigSuccess',
        createConfigError = '[SvtTestTypes] createConfigError',
        leave = '[SvtTestTypes] leave',
    }

    export const fetchAllRequestAction = createAction(
        ActionType.fetchAllRequest,
        props<{ force?: boolean }>(),
    )

    export const fetchAllSuccessAction = createAction(
        ActionType.fetchAllSuccess,
        props<{
            testTypes: EpicSvtTestType[]
            testTypeConfigs: EpicSvtTestTypeConfig[]
        }>(),
    )

    export const fetchAllErrorAction = createAction(
        ActionType.fetchAllError,
        props<{ error: Error }>(),
    )

    export const setActiveTestTypeAction = createAction(
        ActionType.setActiveTestType,
        props<{ testTypeId: number | null }>(),
    )

    export const createRequestAction = createAction(
        ActionType.createRequest,
        props<{ create: EpicSvtTestTypeCreate }>(),
    )

    export type CreateSuccessActionPayload = {
        testType: EpicSvtTestType
        testTypeConfig: EpicSvtTestTypeConfig
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
        props<{ id: number; update: EpicSvtTestTypeUpdate }>(),
    )

    export const updateSuccessAction = createAction(
        ActionType.updateSuccess,
        props<{ entity: EpicSvtTestType }>(),
    )

    export const updateErrorAction = createAction(
        ActionType.updateError,
        props<{ error: Error }>(),
    )

    export const createConfigRequestAction = createAction(
        ActionType.createConfigRequest,
        props<{ create: EpicSvtTestTypeConfigCreate }>(),
    )

    export const createConfigSuccessAction = createAction(
        ActionType.createConfigSuccess,
        props<{ entity: EpicSvtTestTypeConfig }>(),
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

