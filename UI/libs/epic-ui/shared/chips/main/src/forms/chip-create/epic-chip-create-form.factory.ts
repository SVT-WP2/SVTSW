import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { BaseFormFactory } from 'epic-ui/utils'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicChipCreateForm } from './epic-chip-create-form.models'

import Form = EpicChipCreateForm


@Injectable({ providedIn: 'root' })
export class EpicChipCreateFormFactory extends BaseFormFactory<Form.FormData, FormGroup<Form.FormGroupControls>> {

    protected readonly epicEnumFacade = inject(EpicEnumsFacade)

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return forkJoin({
            enumsCollection: this.epicEnumFacade.fetchData(),
        })
            .pipe(
                map((({ enumsCollection }) => {
                    const formGroup = Form.createFromGroup(initFormData)
                    formGroup.controls[Form.FormField.generalLocation].selectOptions = enumsCollection.wpGeneralLocation
                    return formGroup
                })),
            )
    }

}
