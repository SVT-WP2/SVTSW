import { Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { Observable, of } from 'rxjs'

import { EpicEquipmentTypeUpdateForm } from '../../models'

import Form = EpicEquipmentTypeUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicEquipmentTypeUpdateFormFactory {

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return of(Form.createFromGroup(initFormData))
    }

}
