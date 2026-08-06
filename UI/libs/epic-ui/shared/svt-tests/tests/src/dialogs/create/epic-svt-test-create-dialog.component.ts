import { Component } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicAlertModule, EpicIconComponent, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicSvtTestCreateForm, EpicSvtTestCreateFormComponent } from '../../forms'

import Form = EpicSvtTestCreateForm


@Component({
    selector: 'epic-svt-test-create-dialog',
    templateUrl: './epic-svt-test-create-dialog.component.html',
    imports: [
        MatDialogModule,
        MatButton,
        TranslatePipe,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicIconComponent,
        EpicSvtTestCreateFormComponent,
    ],
})
export class EpicSvtTestCreateDialogComponent extends BaseFormDialogComponent<Form.FormData, Form.FormGroupWithOptions> {

    formGroup: Form.FormGroupWithOptions

    onFormGroupReady(formGroup: Form.FormGroupWithOptions): void {
        this.formGroup = formGroup
    }

}
