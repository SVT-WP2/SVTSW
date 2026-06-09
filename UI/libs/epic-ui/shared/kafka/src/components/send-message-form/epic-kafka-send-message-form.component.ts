import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatFormField } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { BaseComponent } from 'epic-ui/utils'

import { EpicKafkaSendMessageForm } from '../../models'

import Form = EpicKafkaSendMessageForm


@Component({
    selector: 'epic-kafka-send-message-form',
    templateUrl: 'epic-kafka-send-message-form.component.html',
    standalone: true,
    imports: [
        FormsModule,
        ReactiveFormsModule,
        MatFormField,
        MatInputModule,
        MatButton,
    ],
})
export class EpicKafkaSendMessageFormComponent extends BaseComponent implements OnChanges {

    @Input() isProcessing = false
    @Output() submit$ = new EventEmitter<Form.FormValue>

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

    onSubmitBtnClicked(): void {
        this.submit$.emit(
            this.formGroup.value as Form.FormValue,
        )
    }

}
