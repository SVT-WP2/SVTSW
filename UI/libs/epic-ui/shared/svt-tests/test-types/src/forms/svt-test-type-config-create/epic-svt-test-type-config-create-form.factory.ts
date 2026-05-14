import { Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { Observable, of } from 'rxjs'

import { EpicSvtTestTypeConfigCreateForm } from './epic-svt-test-type-config-create-form.models'

import Form = EpicSvtTestTypeConfigCreateForm


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTypeConfigCreateFormFactory {

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return of(Form.createFromGroup(initFormData))
    }

}

