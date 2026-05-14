import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { BaseFormFactory } from 'epic-ui/utils'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicChipCreateWithFileForm } from './epic-chip-create-with-file-form.models'

import Form = EpicChipCreateWithFileForm


@Injectable({ providedIn: 'root' })
export class EpicChipCreateWithFileFormFactory extends BaseFormFactory<Form.FormData, FormGroup<Form.FormGroupControls>> {

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
