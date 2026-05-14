import { ThemePalette } from '@angular/material/core'
import { ToastPackage, IndividualConfig } from 'ngx-toastr'

import { EpicButton } from '../../button'


export namespace EpicToastr {

    export enum EpicToastrType {
        Info = 'toast-info',
        Success = 'toast-success',
        Warning = 'toast-warning',
        Error = 'toast-error',
    }

    export function getToastrTypeIconName(toastrType: EpicToastrType): string {
        switch(toastrType) {
            case EpicToastrType.Success:
                return 'epic-step-approve-done'
            case EpicToastrType.Warning:
                return 'epic-attention'
            case EpicToastrType.Error:
                return 'epic-close-outline'
            case EpicToastrType.Info:
                return 'epic-info'
            default:
                throw new Error('Unknown toastr type')
        }
    }

    export type ActionOptions = {
        toastPackage: ToastPackage
    }

    export type Action = {
        onClick?: (options: ActionOptions) => void
        color?: ThemePalette
        icon?: string
        title: string
        disabled?: boolean
        buttonStyle?: EpicButton.ButtonStyle // default is flat
    }

    export type PayloadWithActions =
        & Record<string, any>
        &
        {
            actions?: Action[]
        }

    export function extractActions(payload: PayloadWithActions): Action[] {
        return payload?.actions || []
    }

    export function createPayloadWithActions(actions: Action[]): PayloadWithActions {
        return {
            actions,
        }
    }

    export function createConfigWithActions(actions: Action[]): Partial<IndividualConfig> {
        return {
            payload: createPayloadWithActions(actions),
        }
    }

}
