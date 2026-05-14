import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { EpicWaferTypesFacade } from 'epic-ui/shared/wafer-types'
import { EpicWpMachinesFacade } from 'epic-ui/shared/wp'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicWpProjectAdminUpdateForm } from '../../models'

import Form = EpicWpProjectAdminUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicWpProjectAdminUpdateFormFactory {

    protected readonly epicEnumFacade = inject(EpicEnumsFacade)
    protected readonly epicWpMachinesFacade = inject(EpicWpMachinesFacade)
    protected readonly epicWaferTypesFacade = inject(EpicWaferTypesFacade)

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return forkJoin({
            enumsCollection: this.epicEnumFacade.fetchData(),
            wpMachines: this.epicWpMachinesFacade.fetchAll(),
            waferTypes: this.epicWaferTypesFacade.fetchAll(),
        })
            .pipe(
                map((({ enumsCollection, wpMachines, waferTypes }) => {
                    const formGroup = Form.createFromGroup(initFormData)
                    formGroup.controls[Form.FormField.wpMachineId].selectOptions = wpMachines
                    formGroup.controls[Form.FormField.waferTypeId].selectOptions = waferTypes
                    formGroup.controls[Form.FormField.asicFamilyType].selectOptions = enumsCollection.asicFamilyType
                    formGroup.controls[Form.FormField.orientation].selectOptions = enumsCollection.waferMapOrientation

                    return formGroup
                })),
            )
    }

}
