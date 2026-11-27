import { Component } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatDialogModule } from '@angular/material/dialog'
import { EpicAlertModule, EpicIconComponent, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicAuthPasswordChangeFormComponent } from '../../forms'
import { EpicAuthPasswordChangeForm } from '../../models'

import Form = EpicAuthPasswordChangeForm


/** The dialog of the own password (the user menu → "Change password"). */
@Component({
    selector: 'epic-auth-password-change-dialog',
    templateUrl: './epic-auth-password-change-dialog.component.html',
    imports: [
        MatDialogModule,
        MatButton,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicIconComponent,
        EpicAuthPasswordChangeFormComponent,
    ],
})
export class EpicAuthPasswordChangeDialogComponent extends BaseFormDialogComponent<Form.FormData> {

    formGroup: FormGroup<Form.FormGroupControls> | null = null

    onFormGroupReady(formGroup: FormGroup<Form.FormGroupControls>): void {
        this.formGroup = formGroup
    }

}
