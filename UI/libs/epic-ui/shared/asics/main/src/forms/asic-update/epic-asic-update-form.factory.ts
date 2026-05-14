import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicWafersApiClient } from 'epic-ui/api'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { BaseFormFactory } from 'epic-ui/utils'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicAsicUpdateForm } from '../../models'

import Form = EpicAsicUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicAsicUpdateFormFactory extends BaseFormFactory<Form.FormData, FormGroup<Form.FormGroupControls>> {

    protected readonly epicWafersApiClient = inject(EpicWafersApiClient)
    protected readonly epicEnumFacade = inject(EpicEnumsFacade)

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return forkJoin({
            wafers: this.epicWafersApiClient.fetchAll(),
            enumsCollection: this.epicEnumFacade.fetchData(),
        })
            .pipe(
                map((({ wafers, enumsCollection }) => {
                    const formGroup = Form.createFromGroup(initFormData)
                    formGroup.controls[Form.FormField.waferId].selectOptions = wafers
                    formGroup.controls[Form.FormField.familyType].selectOptions = enumsCollection.asicFamilyType
                    formGroup.controls[Form.FormField.quality].selectOptions = enumsCollection.asicQuality
                    return formGroup
                })),
            )
    }

}
