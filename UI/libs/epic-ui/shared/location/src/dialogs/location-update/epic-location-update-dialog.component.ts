import { Component, inject } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicLocationUpdateForm, EpicLocationUpdateFormComponent } from '../../forms'

import { EpicLocationUpdateDialog } from './epic-location-update-dialog.models'

import From = EpicLocationUpdateForm
import Dialog = EpicLocationUpdateDialog


@Component({
    selector: 'epic-wafer-location-update-dialog',
    templateUrl: './epic-location-update-dialog.component.html',
    imports: [
        TranslatePipe,
        MatDialogModule,
        MatButton,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicIconComponent,
        EpicLocationUpdateFormComponent,
    ],
})
export class EpicLocationUpdateDialogComponent extends BaseFormDialogComponent<From.FormData> {

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    formGroup: FormGroup<From.FormGroupControls>

    onFormGroupReady(formGroup: FormGroup<From.FormGroupControls>): void {
        this.formGroup = formGroup
    }

}
