import { Component } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatDialogModule } from '@angular/material/dialog'
import { EpicAlertModule, EpicIconComponent, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicUserCreateFormComponent } from '../../forms'
import { EpicUserCreateForm } from '../../models'

import Form = EpicUserCreateForm


@Component({
    selector: 'epic-user-create-dialog',
    templateUrl: './epic-user-create-dialog.component.html',
    imports: [
        MatDialogModule,
        MatButton,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicIconComponent,
        EpicUserCreateFormComponent,
    ],
})
export class EpicUserCreateDialogComponent extends BaseFormDialogComponent<Form.FormData> {

    formGroup: FormGroup<Form.FormGroupControls> | null = null

    onFormGroupReady(formGroup: FormGroup<Form.FormGroupControls>): void {
        this.formGroup = formGroup
    }

}
