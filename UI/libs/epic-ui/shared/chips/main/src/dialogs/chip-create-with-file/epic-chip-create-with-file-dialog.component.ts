import { Component, EventEmitter, inject, Output, signal } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { MatDivider } from '@angular/material/divider'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicChipCreateWithFileForm, EpicChipCreateWithFileFormComponent } from '../../forms'

import { EpicChipCreateWithFileDialog } from './epic-chip-create-with-file-dialog.models'

import Dialog = EpicChipCreateWithFileDialog
import Form = EpicChipCreateWithFileForm


@Component({
    selector: 'epic-chip-create-with-file-dialog',
    templateUrl: './epic-chip-create-with-file-dialog.component.html',
    imports: [
        MatDialogModule,
        MatButton,
        TranslatePipe,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicIconComponent,
        EpicChipCreateWithFileFormComponent,
        MatDivider,
    ],
})
export class EpicChipCreateWithFileDialogComponent extends BaseFormDialogComponent<Form.FormData> {

    @Output() preview$ = new EventEmitter<Form.FormData>()

    readonly formGroup = signal<FormGroup<Form.FormGroupControls> | null>(null)

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    onPreviewBtnClicked(): void {
        this.preview$.emit(
            this.formGroup()!.getRawValue() as Form.FormData,
        )
    }

    onFormGroupReady(formGroup: FormGroup<Form.FormGroupControls>): void {
        this.formGroup.set(formGroup)
    }

}
