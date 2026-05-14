import { inject, Injectable } from '@angular/core'
import { EpicSvtTestTypeConfigsDataFacade, EpicSvtTestTypesDataFacade } from 'epic-ui/shared/svt-test/test-types'
import { SimpleDataSource } from 'epic-ui/utils'
import { keyBy } from 'lodash-es'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicSvtTestTemplateGrid } from '../models'

import { EpicSvtTestTemplateFacade } from './epic-svt-test-template.facade'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTemplateGridDataSource extends SimpleDataSource<EpicSvtTestTemplateGrid.RowEntity[]> {

    protected readonly epicSvtTestTemplateFacade = inject(EpicSvtTestTemplateFacade)
    protected readonly epicSvtTestTypeConfigsDataFacade = inject(EpicSvtTestTypeConfigsDataFacade)
    protected readonly epicSvtTestTypesDataFacade = inject(EpicSvtTestTypesDataFacade)

    protected override getDataObserver(filterValue: unknown, force: boolean): Observable<EpicSvtTestTemplateGrid.RowEntity[]> {
        return forkJoin({
            templates: this.epicSvtTestTemplateFacade.fetchData(force),
            testTypeConfigs: this.epicSvtTestTypeConfigsDataFacade.fetchData(),
            testTypes: this.epicSvtTestTypesDataFacade.fetchData(),
        })
            .pipe(
                map(({ templates, testTypeConfigs, testTypes }) => {
                    const testTypesMap = keyBy(testTypes, 'id')
                    const testTypeConfigsMap = keyBy(testTypeConfigs, 'id')
                    return templates
                        .map(item => ({
                            ...item,
                            testType: testTypesMap[item.testTypeId],
                            testTypeConfig: testTypeConfigsMap[item.testTypeConfigId],
                        } satisfies EpicSvtTestTemplateGrid.RowEntity))
                }),
            )

    }

}

