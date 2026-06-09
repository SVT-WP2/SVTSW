import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicWaferTypeUpdateForm } from '../../models'

import Form = EpicWaferTypeUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicWaferTypeUpdateFormFactory {

    protected readonly epicEnumFacade = inject(EpicEnumsFacade)

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return forkJoin({
            enumsCollection: this.epicEnumFacade.fetchData(),
        })
            .pipe(
                map((({ enumsCollection }) => {
                    const formGroup = Form.createFromGroup(initFormData)
                    formGroup.controls[Form.FormField.engineeringRun].selectOptions = enumsCollection.engineeringRun
                    formGroup.controls[Form.FormField.foundry].selectOptions = enumsCollection.foundryName
                    formGroup.controls[Form.FormField.technology].selectOptions = enumsCollection.waferTech
                    return formGroup
                })),
            )
    }

}
