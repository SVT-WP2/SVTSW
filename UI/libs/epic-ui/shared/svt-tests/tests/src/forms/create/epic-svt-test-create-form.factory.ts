import { inject, Injectable } from '@angular/core'
import {
    EpicSvtDutEntityName,
    EpicSvtTestSetupConfigsApiClient,
    EpicSvtTestSetupsApiClient,
    EpicSvtTestTemplatesApiClient,
    EpicSvtTestTypeConfigsApiClient,
    EpicSvtTestTypesApiClient,
} from 'epic-ui/api'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicSvtTestCreateForm } from './epic-svt-test-create-form.models'

import Form = EpicSvtTestCreateForm


@Injectable({ providedIn: 'root' })
export class EpicSvtTestCreateFormFactory {

    // DI
    protected readonly epicSvtTestSetupsApiClient = inject(EpicSvtTestSetupsApiClient)
    protected readonly epicSvtTestSetupConfigsApiClient = inject(EpicSvtTestSetupConfigsApiClient)
    protected readonly epicSvtTestTemplatesApiClient = inject(EpicSvtTestTemplatesApiClient)
    protected readonly epicSvtTestTypesApiClient = inject(EpicSvtTestTypesApiClient)
    protected readonly epicSvtTestTypeConfigsApiClient = inject(EpicSvtTestTypeConfigsApiClient)

    createFormGroup(initFormData?: Partial<Form.FormData>): Observable<Form.FormGroupWithOptions> {
        return forkJoin({
            testSetups: this.epicSvtTestSetupsApiClient.fetchList(),
            testSetupConfigs: this.epicSvtTestSetupConfigsApiClient.fetchList(),
            testTemplates: this.epicSvtTestTemplatesApiClient.fetchList(),
            testTypes: this.epicSvtTestTypesApiClient.fetchList(),
            testTypeConfigs: this.epicSvtTestTypeConfigsApiClient.fetchList(),
        })
            .pipe(
                map((({ testSetups, testSetupConfigs, testTemplates, testTypes, testTypeConfigs }) => {
                    const formGroup = Form.createFromGroup(initFormData)

                    formGroup.controls.testSetupId.selectOptions = testSetups
                    formGroup.controls.dutEntityName.selectOptions = Object.values(EpicSvtDutEntityName)

                    // narrowed down by the component as the user picks a setup / a DUT
                    formGroup.allTestSetupConfigs = testSetupConfigs
                    formGroup.allTestTemplates = Form.toTestTemplateOptions(testTemplates, testTypes, testTypeConfigs)

                    return formGroup
                })),
            )
    }

}
