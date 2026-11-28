import { Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { Observable, of } from 'rxjs'

import { EpicUserPasswordForm } from '../../models'

import Form = EpicUserPasswordForm


@Injectable({ providedIn: 'root' })
export class EpicUserPasswordFormFactory {

    createFormGroup(): Observable<FormGroup<Form.FormGroupControls>> {
        return of(Form.createFromGroup())
    }

}
