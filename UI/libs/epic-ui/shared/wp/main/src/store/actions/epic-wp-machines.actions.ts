import { createAction, props } from '@ngrx/store'
import {
    EpicWpMachine,
    EpicWpMachineCreate,
    EpicWpMachineUpdate,
} from 'epic-ui/api'


export namespace EpicWpMachinesActions {

    export enum ActionType {
        fetchAllRequest = '[WpMachine] fetchAllRequest',
        fetchAllSuccess = '[WpMachine] fetchAllSuccess',
        fetchAllError = '[WpMachine] fetchAllError',
        fetchOneRequest = '[WpMachine] fetchOneRequest',
        fetchOneSuccess = '[WpMachine] fetchOneSuccess',
        fetchOneError = '[WpMachine] fetchOneError',
        createRequest = '[WpMachine] createRequest',
        createSuccess = '[WpMachine] createSuccess',
        createError = '[WpMachine] createError',
        updateRequest = '[WpMachine] updateRequest',
        updateSuccess = '[WpMachine] updateSuccess',
        updateError = '[WpMachine] updateError',
        updateInstalledProbeCardRequest = '[WpMachine] updateInstalledProbeCardRequest',
        updateInstalledProbeCardSuccess = '[WpMachine] updateInstalledProbeCardSuccess',
        updateInstalledProbeCardError = '[WpMachine] updateInstalledProbeCardError',
        updateLoadedWaferRequest = '[WpMachine] updateLoadedWaferRequest',
        updateLoadedWaferSuccess = '[WpMachine] updateLoadedWaferSuccess',
        updateLoadedWaferError = '[WpMachine] updateLoadedWaferError',
    }

    export const fetchAllRequestAction = createAction(
        ActionType.fetchAllRequest,
        props<{ force?: boolean }>(),
    )

    export const fetchAllSuccessAction = createAction(
        ActionType.fetchAllSuccess,
        props<{ entities: EpicWpMachine[] }>(),
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
        props<{ entities: EpicWpMachine[] }>(),
    )

    export const fetchOneErrorAction = createAction(
        ActionType.fetchOneError,
        props<{ error: Error }>(),
    )

    export const createRequestAction = createAction(
        ActionType.createRequest,
        props<{ create: EpicWpMachineCreate }>(),
    )

    export const createSuccessAction = createAction(
        ActionType.createSuccess,
        props<{ entity: EpicWpMachine }>(),
    )

    export const createErrorAction = createAction(
        ActionType.createError,
        props<{ error: Error }>(),
    )

    export const updateRequestAction = createAction(
        ActionType.updateRequest,
        props<{ id: number; update: Partial<EpicWpMachineUpdate> }>(),
    )

    export const updateSuccessAction = createAction(
        ActionType.updateSuccess,
        props<{ entity: EpicWpMachine }>(),
    )

    export const updateErrorAction = createAction(
        ActionType.updateError,
        props<{ error: Error }>(),
    )
    
    export const updateInstalledProbeCardRequestAction = createAction(
        ActionType.updateInstalledProbeCardRequest,
        props<{ wpMachineId: number; installedProbeCardId: number | null }>(),
    )

    export const updateInstalledProbeCardSuccessAction = createAction(
        ActionType.updateInstalledProbeCardSuccess,
        props<{ entity: EpicWpMachine }>(),
    )

    export const updateInstalledProbeCardErrorAction = createAction(
        ActionType.updateInstalledProbeCardError,
        props<{ error: Error }>(),
    )

    export const updateLoadedWaferRequestAction = createAction(
        ActionType.updateLoadedWaferRequest,
        props<{ wpMachineId: number; loadedWaferId: number | null }>(),
    )

    export const updateLoadedWaferSuccessAction = createAction(
        ActionType.updateLoadedWaferSuccess,
        props<{ entity: EpicWpMachine }>(),
    )

    export const updateLoadedWaferErrorAction = createAction(
        ActionType.updateLoadedWaferError,
        props<{ error: Error }>(),
    )

}
