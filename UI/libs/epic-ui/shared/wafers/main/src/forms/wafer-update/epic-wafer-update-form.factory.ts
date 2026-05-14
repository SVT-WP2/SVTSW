import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicWaferTypesApiClient } from 'epic-ui/api'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { BaseFormFactory } from 'epic-ui/utils'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicWaferUpdateForm } from '../../models'

import Form = EpicWaferUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicWaferUpdateFormFactory extends BaseFormFactory<Form.FormData, FormGroup<Form.FormGroupControls>> {

    protected readonly epicEnumFacade = inject(EpicEnumsFacade)
    protected readonly epicWaferTypesApiClient = inject(EpicWaferTypesApiClient)

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return forkJoin({
            waferTypesList: this.epicWaferTypesApiClient.fetchAll(),
            enumsCollection: this.epicEnumFacade.fetchData(),
        })
            .pipe(
                map((({ waferTypesList, enumsCollection }) => {
                    const formGroup = Form.createFromGroup(initFormData)
                    formGroup.controls[Form.FormField.waferType].selectOptions = waferTypesList
                    formGroup.controls[Form.FormField.generalLocation].selectOptions = enumsCollection.wpGeneralLocation
                    return formGroup
                })),
            )
    }

}
