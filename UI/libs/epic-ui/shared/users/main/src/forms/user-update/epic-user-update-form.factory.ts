import { Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { Observable, of } from 'rxjs'

import { EpicUserUpdateForm } from '../../models'

import Form = EpicUserUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicUserUpdateFormFactory {

    createFormGroup(
        initFormData?: Partial<Form.FormData>,
        options?: Partial<Form.FormOptions>,
    ): Observable<FormGroup<Form.FormGroupControls>> {
        return of(Form.createFromGroup(initFormData, options))
    }

}
