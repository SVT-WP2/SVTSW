import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatDivider } from '@angular/material/divider'
import { MatFormField } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { BaseComponent } from 'epic-ui/utils'

import { EpicTcpSendMessageForm } from '../../models'

import Form = EpicTcpSendMessageForm


@Component({
    selector: 'epic-tcp-send-message-form',
    templateUrl: 'epic-tcp-send-message-form.component.html',
    standalone: true,
    imports: [
        FormsModule,
        ReactiveFormsModule,
        MatFormField,
        MatInputModule,
        MatButton,
        MatDivider,
    ],
})
export class EpicTcpSendMessageFormComponent extends BaseComponent implements OnChanges {

    @Input() isProcessing = false

    @Output() send$ = new EventEmitter<Form.FormValue>
    @Output() sendAndRead$ = new EventEmitter<Form.FormValue>
    @Output() read$ = new EventEmitter<Form.FormValue>
    @Output() cancel$ = new EventEmitter<void>

    readonly formGroup = Form.createFormGroup()
    readonly FormField = Form.FormField

    ngOnChanges({ isProcessing }: SimpleChanges): void {
        if (isProcessing) {
            if (isProcessing.currentValue) {
                this.formGroup.disable()
            }
            else {
                this.formGroup.enable()
            }
        }
    }

    onSendBtnClicked(): void {
        this.send$.emit(
            this.formGroup.value as Form.FormValue,
        )
    }

    onReadBtnClicked(): void {
        this.read$.emit(
            this.formGroup.getRawValue() as Form.FormValue,
        )
    }

    onSendAndReadBtnClicked(): void {
        this.sendAndRead$.emit(
            this.formGroup.getRawValue() as Form.FormValue,
        )
    }

    onCancelBtnClicked(): void {
        this.cancel$.emit()
    }

}
