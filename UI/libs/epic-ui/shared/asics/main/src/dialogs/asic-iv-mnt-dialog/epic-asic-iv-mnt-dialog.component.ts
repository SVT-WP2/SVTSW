import { Component, EventEmitter, inject, Output, signal } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { EpicAlertModule, EpicLabelModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { EpicIvMntNewForm } from 'epic-ui/shared/iv-mnt'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import { EpicAsicIvMntContainerComponent } from '../../containers'
import { EpicAsicIvMntDialog } from '../../models'

import Dialog = EpicAsicIvMntDialog
import Form = EpicIvMntNewForm


@Component({
    selector: 'epic-asic-update-dialog',
    templateUrl: './epic-asic-iv-mnt-dialog.component.html',
    standalone: true,
    imports: [
        MatDialogModule,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicAsicIvMntContainerComponent,
        EpicLabelModule,
    ],
})
export class EpicAsicIvMntDialogComponent extends BaseComponent {

    @Output() submit$ = new EventEmitter<Form.FormValue>()

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    readonly processing = signal<ProcessingStore.EventProcessingState>(ProcessingStore.getDefaultProcessingState())

    readonly isUpdate = !!this.dialogData.formData && !this.dialogData.isClone

    onSubmitBtnClicked(formGroup: FormGroup<Form.FormGroupControls>) {
        this.submit$.emit(formGroup.value as Form.FormValue)
    }

}
