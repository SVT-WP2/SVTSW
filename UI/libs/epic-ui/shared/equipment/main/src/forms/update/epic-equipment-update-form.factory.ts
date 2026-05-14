import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { EpicEquipmentTypesFacade } from 'epic-ui/shared/equipment-types'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicEquipmentUpdateForm } from '../../models'

import Form = EpicEquipmentUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicEquipmentUpdateFormFactory {

    // DI
    protected readonly epicEnumFacade = inject(EpicEnumsFacade)
    protected readonly epicEquipmentTypesFacade = inject(EpicEquipmentTypesFacade)

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return forkJoin({
            equipmentTypes: this.epicEquipmentTypesFacade.fetchData(),
            enumsCollection: this.epicEnumFacade.fetchData(),
        })
            .pipe(
                map((({ equipmentTypes, enumsCollection }) => {
                    const formGroup = Form.createFromGroup(initFormData)
                    formGroup.controls[Form.FormField.equipmentTypeId].selectOptions = equipmentTypes
                    formGroup.controls[Form.FormField.generalLocation].selectOptions = enumsCollection.wpGeneralLocation
                    return formGroup
                })),
            )
    }

}
