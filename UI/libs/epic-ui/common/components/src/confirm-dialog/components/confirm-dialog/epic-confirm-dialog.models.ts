import { TemplateRef } from '@angular/core'
import { ThemePalette } from '@angular/material/core'


export namespace EpicConfirmDialog {

    export type Data = {
        headerTitle?: string
        headerIconName?: string
        message?: string
        messageTemplateRef?: TemplateRef<any>
        hideCancelButton?: boolean // false by default
        confirmButtonText?: string
        confirmButtonColor?: ThemePalette
        maxHeight?: number | string
    }

}
