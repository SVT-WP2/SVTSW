import { Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { Observable, of } from 'rxjs'

import { EpicWpProbeCardUpdateForm } from '../../models'

import Form = EpicWpProbeCardUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicWpProbeCardUpdateFormFactory {

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        const formGroup = Form.createFromGroup(initFormData)

        return of(formGroup)

        // return forkJoin({
        //     // wpProbeCards: of([]),
        //     // connectionTypes: of<string[]>(['TCP']),
        // })
        //     .pipe(
        //         map((({ wpProbeCards, connectionTypes }) => {
        //             const formGroup = Form.createFromGroup(initFormData)
        //             return formGroup
        //         })),
        //     )
    }

}
