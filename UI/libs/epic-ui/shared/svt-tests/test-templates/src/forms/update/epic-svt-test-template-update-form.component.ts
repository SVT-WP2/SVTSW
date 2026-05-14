import { Component, inject, input, OnInit, signal } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MatOption } from '@angular/material/core'
import {
    MAT_FORM_FIELD_DEFAULT_OPTIONS,
    MatError,
    MatFormField,
    MatFormFieldDefaultOptions,
    MatFormFieldModule,
    MatLabel,
} from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelect } from '@angular/material/select'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { EpicSvtTestType, EpicSvtTestTypeConfig } from 'epic-ui/api'
import { EpicContentErrorModule, EpicLoaderComponent, EpicNoResultModule } from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'
import { takeUntil } from 'rxjs'

import { EpicSvtTestTemplateUpdateForm } from '../../models'

import { EpicSvtTestTemplateUpdateFormFactory } from './epic-svt-test-template-update-form.factory'

import Form = EpicSvtTestTemplateUpdateForm


@Component({
    selector: 'epic-svt-test-template-update-form',
    templateUrl: 'epic-svt-test-template-update-form.component.html',
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
        MatFormField,
        MatLabel,
        MatError,
        MatFormFieldModule,
        MatInputModule,
        FormsModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicNoResultModule,
        MatSlideToggleModule,
        MatOption,
        MatSelect,
    ],
})
export class EpicSvtTestTemplateUpdateFormComponent
    extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>>
    implements OnInit {

    readonly isEditMode = input(false)

    readonly FormField = Form.FormField

    readonly activeTestTypes = signal<EpicSvtTestType[]>([])
    readonly activeTestTypeConfigs = signal<EpicSvtTestTypeConfig[]>([])

    protected readonly formFactory = inject(EpicSvtTestTemplateUpdateFormFactory)

    protected override initFormGroup() {
        super.initFormGroup()

        const disallowedFields = [Form.FormField.testTypeId, Form.FormField.testTypeConfigId]
        disallowedFields.forEach(field => this.formGroup.controls[field].disable())

        if (this.isEditMode()) {
            const dutType = this.formGroup.controls.dutType.value
            const testTypeId = this.formGroup.controls.testTypeId.value
            this.initTestTypeControl(dutType)
            this.initTestTypeConfigControl(testTypeId)

            const disallowedFields = Object.values(Form.FormField)
                .filter(item => item !== Form.FormField.isEnabled)
            disallowedFields.forEach(field => this.formGroup.controls[field].disable())

        }
        else {
            this.formGroup.controls.dutType
                .valueChanges
                .pipe(
                    takeUntil(this.destroyed$),
                )
                .subscribe((dutType) => {
                    this.initTestTypeControl(dutType)
                })

            this.formGroup.controls.testTypeId
                .valueChanges
                .pipe(
                    takeUntil(this.destroyed$),
                )
                .subscribe((testTypeId) => {
                    this.initTestTypeConfigControl(testTypeId)
                })
        }

    }

    protected initTestTypeConfigControl(testTypeId: number | null) {
        if (!testTypeId) {
            // do nothing
            this.activeTestTypeConfigs.set([])
            this.formGroup.controls.testTypeConfigId.setValue(null)
            return
        }
        const activeTestTypeConfigs = this.formGroup.controls.testTypeConfigId.selectOptions
            .filter(option => option.testTypeId === testTypeId)

        this.activeTestTypeConfigs.set(activeTestTypeConfigs)

        this.formGroup.controls.testTypeConfigId.setValue(activeTestTypeConfigs[0]?.id ?? null)
        if (this.formGroup.controls.testTypeConfigId.disabled) {
            this.formGroup.controls.testTypeConfigId.enable()
        }

    }

    protected initTestTypeControl(dutType: string | null) {
        if (!dutType) {
            // do nothing
            return
        }
        const activeTestTypes = this.formGroup.controls.testTypeId.selectOptions
            .filter(option => option.dutTypes.includes(dutType))

        this.activeTestTypes.set(activeTestTypes)

        this.formGroup.controls.testTypeId.setValue(activeTestTypes[0]?.id ?? null)
        if (this.formGroup.controls.testTypeId.disabled) {
            this.formGroup.controls.testTypeId.enable()
        }

    }

}

