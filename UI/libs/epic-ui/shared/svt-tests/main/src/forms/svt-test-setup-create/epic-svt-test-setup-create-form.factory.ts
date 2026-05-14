import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicSvtTestSetupCreateForm } from './epic-svt-test-setup-create-form.models'

import Form = EpicSvtTestSetupCreateForm


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupCreateFormFactory {

    protected readonly epicEnumFacade = inject(EpicEnumsFacade)

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return forkJoin({
            enumsCollection: this.epicEnumFacade.fetchData(),
        })
            .pipe(
                map((({ enumsCollection }) => {
                    const formGroup = Form.createFromGroup(initFormData)
                    formGroup.controls.generalLocation.selectOptions = enumsCollection.wpGeneralLocation
                    return formGroup
                })),
            )
    }

}
