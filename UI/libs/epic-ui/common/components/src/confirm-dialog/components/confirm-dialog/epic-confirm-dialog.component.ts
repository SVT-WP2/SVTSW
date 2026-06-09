import { Component, EventEmitter, Inject, Input, Output } from '@angular/core'
import { ThemePalette } from '@angular/material/core'
import { MAT_DIALOG_DATA } from '@angular/material/dialog'
import { BaseComponent } from 'epic-ui/utils'


import { EpicConfirmDialog } from './epic-confirm-dialog.models'


@Component({
    selector: 'epic-confirm-dialog',
    templateUrl: './epic-confirm-dialog.component.html',
    standalone: false,
})
export class EpicConfirmDialogComponent extends BaseComponent {

    @Input() isProcessing = false

    @Output() confirm$ = new EventEmitter<void>()
    @Output() decline$ = new EventEmitter<void>()

    readonly defaultConfirmBtnStyles: ThemePalette = 'primary'
    readonly defaultMessage = 'SHARED.CONFIRM_DIALOG__DEFAULT_MESSAGE'
    readonly defaultConfirmButtonText = 'COMMON.CONFIRM'

    constructor(@Inject(MAT_DIALOG_DATA) public data: EpicConfirmDialog.Data) {
        super()
    }

    onConfirmButtonClicked() {
        this.confirm$.emit()
    }

    onCancelButtonClicked() {
        this.decline$.emit()
    }

}
