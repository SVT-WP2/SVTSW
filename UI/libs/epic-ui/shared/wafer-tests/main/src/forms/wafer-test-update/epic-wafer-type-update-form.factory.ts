import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicWafersApiClient } from 'epic-ui/api'
import { EpicAsicTestTypesFacade } from 'epic-ui/shared/asic-tests'
import { EpicWpMachinesFacade } from 'epic-ui/shared/wp'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicWaferTestUpdateForm } from '../../models'

import Form = EpicWaferTestUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicWaferTypeUpdateFormFactory {

    protected readonly epicAsicTestTypesFacade = inject(EpicAsicTestTypesFacade)
    protected readonly epicWpMachinesFacade = inject(EpicWpMachinesFacade)
    protected readonly epicWafersApiClient = inject(EpicWafersApiClient)

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return forkJoin({
            wafers: this.epicWafersApiClient.fetchAll(),
            wpMachines: this.epicWpMachinesFacade.fetchAll(),
            asicTestTypes: this.epicAsicTestTypesFacade.fetchAll(),
        })
            .pipe(
                map((({ wafers, wpMachines, asicTestTypes }) => {
                    const formGroup = Form.createFromGroup(initFormData)
                    formGroup.controls[Form.FormField.wpMachineId].selectOptions = wpMachines
                    formGroup.controls[Form.FormField.asicTestTypeId].selectOptions = asicTestTypes
                    formGroup.controls[Form.FormField.waferId].selectOptions = wafers
                    return formGroup
                })),
            )
    }

}
