import { Component, EventEmitter, inject, Input, Output } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { EpicAlertModule, EpicIconComponent, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseComponent } from 'epic-ui/utils'

import { EpicUserDialogs } from '../../models'


/**
 * Asks before a user is switched off, and names the user. The name is shown as text: the shared confirm dialog of
 * `epic-ui/common/components` renders its message as HTML, so a name must not go there.
 */
@Component({
    selector: 'epic-user-switch-off-dialog',
    templateUrl: './epic-user-switch-off-dialog.component.html',
    imports: [
        MatDialogModule,
        MatButton,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicIconComponent,
    ],
})
export class EpicUserSwitchOffDialogComponent extends BaseComponent {

    @Input() isProcessing = false
    @Input() processingError: string | null = null

    @Output() confirm$ = new EventEmitter<void>()

    readonly dialogData = inject<EpicUserDialogs.SwitchOffData>(MAT_DIALOG_DATA)

    onConfirmBtnClicked(): void {
        this.processingError = null
        this.confirm$.emit()
    }

}
