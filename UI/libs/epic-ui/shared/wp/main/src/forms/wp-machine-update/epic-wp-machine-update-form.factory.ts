import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { forkJoin, map, Observable, of } from 'rxjs'

import { EpicWpMachineUpdateForm } from '../../models'

import Form = EpicWpMachineUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicWpMachineUpdateFormFactory {

    protected readonly epicEnumFacade = inject(EpicEnumsFacade)

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return forkJoin({
            wpProbeCards: of([]),
            enumsCollection: this.epicEnumFacade.fetchData(),
        })
            .pipe(
                map((({ wpProbeCards, enumsCollection }) => {
                    const formGroup = Form.createFromGroup(initFormData)
                    formGroup.controls[Form.FormField.generalLocation].selectOptions = enumsCollection.wpGeneralLocation
                    formGroup.controls[Form.FormField.connectionType].selectOptions = enumsCollection.wpConnectionType
                    formGroup.controls[Form.FormField.vendor].selectOptions = enumsCollection.wpVendor
                    formGroup.controls[Form.FormField.software].selectOptions = enumsCollection.wpSwType
                    return formGroup
                })),
            )
    }

}
