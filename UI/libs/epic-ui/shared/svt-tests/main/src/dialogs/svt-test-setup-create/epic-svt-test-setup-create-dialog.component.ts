import { Component, inject } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicSvtTestSetupCreateForm, EpicSvtTestSetupCreateFormComponent } from '../../forms'

import { EpicSvtTestSetupCreateDialog } from './epic-svt-test-setup-create-dialog.models'

import Form = EpicSvtTestSetupCreateForm
import Dialog = EpicSvtTestSetupCreateDialog


@Component({
    selector: 'epic-svt-test-setup-create-dialog',
    templateUrl: './epic-svt-test-setup-create-dialog.component.html',
    imports: [
        MatDialogModule,
        MatButton,
        TranslatePipe,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicIconComponent,
        EpicSvtTestSetupCreateFormComponent,
        EpicSvtTestSetupCreateFormComponent,
    ],
})
export class EpicSvtTestSetupCreateDialogComponent extends BaseFormDialogComponent<Form.FormData> {

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    readonly isUpdate = !!this.dialogData.formData && !this.dialogData.isClone

    formGroup: FormGroup<Form.FormGroupControls>

    onFormGroupReady(formGroup: FormGroup<Form.FormGroupControls>): void {
        this.formGroup = formGroup
    }

}
