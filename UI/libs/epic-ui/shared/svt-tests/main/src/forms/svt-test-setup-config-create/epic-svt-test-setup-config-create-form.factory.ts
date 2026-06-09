import { Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { Observable, of } from 'rxjs'

import { EpicSvtTestSetupConfigCreateForm } from './epic-svt-test-setup-config-create-form.models'

import Form = EpicSvtTestSetupConfigCreateForm


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupConfigCreateFormFactory {

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return of(Form.createFromGroup(initFormData))
    }

}
