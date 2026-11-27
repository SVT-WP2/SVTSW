import { Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { Observable, of } from 'rxjs'

import { EpicUserCreateForm } from '../../models'

import Form = EpicUserCreateForm


@Injectable({ providedIn: 'root' })
export class EpicUserCreateFormFactory {

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return of(Form.createFromGroup(initFormData))
    }

}
