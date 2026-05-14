import { Component, inject, Input, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle'
import { MatCheckbox } from '@angular/material/checkbox'
import { MatDatepickerModule } from '@angular/material/datepicker'
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldDefaultOptions, MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatOption, MatSelect } from '@angular/material/select'
import {
    EpicChipsAutocompleteFormControlModule,
    EpicContentErrorModule,
    EpicLoaderComponent,
    EpicNoResultModule,
    EpicSelectModule,
} from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent, EpicSearchPipe } from 'epic-ui/utils'
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search'
import { filter, map, takeUntil } from 'rxjs'

import { EpicWaferTestUpdateForm } from '../../models'

import { EpicWaferTypeUpdateFormFactory } from './epic-wafer-type-update-form.factory'

import Form = EpicWaferTestUpdateForm


@Component({
    selector: 'epic-wafer-test-update-form',
    templateUrl: 'epic-wafer-test-update-form.component.html',
    standalone: true,
    providers: [
        {
            provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
            useValue: {
                appearance: 'outline',
                floatLabel: 'always',
                subscriptSizing: 'dynamic',
            } as MatFormFieldDefaultOptions,
        },
    ],
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        EpicChipsAutocompleteFormControlModule,
        FormsModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicSelectModule,
        MatSelect,
        EpicSearchPipe,
        MatOption,
        NgxMatSelectSearchModule,
        EpicNoResultModule,
        MatCheckbox,
        MatButtonToggleGroup,
        MatButtonToggle,
    ],
})
export class EpicWaferTestUpdateFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>>
    implements OnInit {

    @Input() isEditMode = false

    override formGroup: FormGroup<Form.FormGroupControls>

    readonly FormField = Form.FormField
    readonly wpMachineSearchTermControl = new FormControl<string>('')
    readonly waferSearchTermControl = new FormControl<string>('')
    readonly asicTestTypeSearchTermControl = new FormControl<string>('')

    protected readonly formFactory = inject(EpicWaferTypeUpdateFormFactory)

    protected override initFormGroup() {

        super.initFormGroup()

        if (!this.formGroup.controls[this.FormField.allowCustomName].value) {
            this.formGroup.controls[this.FormField.name].disable()
        }

        this.formGroup.controls[this.FormField.allowCustomName].valueChanges
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe(value => {
                if (value) {
                    this.formGroup.controls[this.FormField.name].enable()
                }
                else {
                    this.formGroup.controls[this.FormField.name].disable()
                }
            })

        this.formGroup.valueChanges
            .pipe(
                filter(value => !value.allowCustomName && (!!value.waferId || !!value.asicTestTypeId)),
                takeUntil(this.destroyed$),
                map(value => {
                    // calculate name
                    const waferId = this.formGroup.controls[Form.FormField.waferId].value
                    const waferName = waferId
                        ? this.formGroup.controls[Form.FormField.waferId].selectOptions.find(item => item.id === waferId)?.serialNumber
                        : ''
                    const asicTestTypeId = this.formGroup.controls[Form.FormField.asicTestTypeId].value
                    const asicTestName = asicTestTypeId
                        ? this.formGroup.controls[Form.FormField.asicTestTypeId].selectOptions
                            .find(item => item.id === asicTestTypeId)?.name
                        : ''
                    return `${waferName} - ${asicTestName}`
                }),
                filter(value => this.formGroup.controls[Form.FormField.name].value !== value),
            )
            .subscribe((value) => {
                this.formGroup.controls[Form.FormField.name].setValue(value)
            })


        if (this.isEditMode) {
            const disallowedFields = [
                Form.FormField.wpMachineId,
                Form.FormField.waferId,
                Form.FormField.asicTestTypeId,
            ]
            disallowedFields.forEach(field => this.formGroup.controls[field].disable())
        }

    }

}
