import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { BaseFormFactory } from 'epic-ui/utils'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicLocationUpdateForm } from './epic-location-update-form.models'

import Form = EpicLocationUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicLocationUpdateFormFactory extends BaseFormFactory<Form.FormData, FormGroup<Form.FormGroupControls>, Form.FormOptions> {

    protected readonly epicEnumFacade = inject(EpicEnumsFacade)

    createFormGroup(initFormData?: Partial<Form.FormData>, options?: Form.FormOptions): Observable<FormGroup<Form.FormGroupControls>> {
        return forkJoin({
            enumsCollection: this.epicEnumFacade.fetchData(),
        })
            .pipe(
                map((({ enumsCollection }) => {
                    const formGroup = Form.createFromGroup(initFormData)
                    formGroup.controls[Form.FormField.generalLocation].selectOptions =
                        options?.excludeGeneralLocation?.length
                            ? enumsCollection.wpGeneralLocation
                                .filter((item) => !options.excludeGeneralLocation?.includes(item))
                            : enumsCollection.wpGeneralLocation
                    return formGroup
                })),
            )
    }

}
