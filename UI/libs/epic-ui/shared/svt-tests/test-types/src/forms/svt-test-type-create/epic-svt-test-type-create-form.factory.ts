import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicSvtTestTypeCreateForm } from './epic-svt-test-type-create-form.models'

import Form = EpicSvtTestTypeCreateForm


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTypeCreateFormFactory {

    protected readonly epicEnumFacade = inject(EpicEnumsFacade)

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return forkJoin({
            enumsCollection: this.epicEnumFacade.fetchData(),
        })
            .pipe(
                map((({ enumsCollection }) => {
                    const formGroup = Form.createFromGroup(initFormData)
                    formGroup.controls.dutTypes.selectOptions = enumsCollection.dutType
                    return formGroup
                })),
            )
    }

}

