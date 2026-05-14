import { inject, Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { EpicEnumsFacade } from 'epic-ui/shared'
import { EpicSvtTestTypeConfigsDataFacade, EpicSvtTestTypesDataFacade } from 'epic-ui/shared/svt-test/test-types'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicSvtTestTemplateUpdateForm } from '../../models'

import Form = EpicSvtTestTemplateUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTemplateUpdateFormFactory {

    protected readonly epicEnumFacade = inject(EpicEnumsFacade)
    protected readonly epicSvtTestTypeConfigsDataFacade = inject(EpicSvtTestTypeConfigsDataFacade)
    protected readonly epicSvtTestTypesDataFacade = inject(EpicSvtTestTypesDataFacade)


    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<FormGroup<Form.FormGroupControls>> {
        return forkJoin({
            enumsCollection: this.epicEnumFacade.fetchData(),
            testTypes: this.epicSvtTestTypesDataFacade.fetchData(),
            testTypeConfigs: this.epicSvtTestTypeConfigsDataFacade.fetchData(),
        })
            .pipe(
                map((({ enumsCollection, testTypes, testTypeConfigs }) => {
                    const formGroup = Form.createFromGroup(initFormData)
                    formGroup.controls.dutType.selectOptions = enumsCollection.dutType
                    formGroup.controls.testTypeId.selectOptions = testTypes
                    formGroup.controls.testTypeConfigId.selectOptions = testTypeConfigs
                    return formGroup
                })),
            )
    }

}

