import { inject, Injectable } from '@angular/core'
import { EpicSvtTestsApiClient, EpicSvtTestsListQuery } from 'epic-ui/api'
import { EpicSvtTestTypeConfigsDataFacade } from 'epic-ui/shared/svt-test/test-types'
import { EpicSvtTestSetupConfigsDataFacade } from 'epic-ui/shared/svt-tests'
import { SimpleDataSource } from 'epic-ui/utils'
import { keyBy } from 'lodash-es'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicSvtTestsGrid } from '../models'


export type EpicSvtTestsGridDsFilter = EpicSvtTestsListQuery.QueryFilter

@Injectable({ providedIn: 'root' })
export class EpicSvtTestsGridDataSource extends SimpleDataSource<EpicSvtTestsGrid.RowEntity[], EpicSvtTestsGridDsFilter> {

    protected readonly epicSvtTestsApiClient = inject(EpicSvtTestsApiClient)
    protected readonly epicSvtTestSetupConfigsDataFacade = inject(EpicSvtTestSetupConfigsDataFacade)
    protected readonly epicSvtTestTypeConfigsDataFacade = inject(EpicSvtTestTypeConfigsDataFacade)

    protected override getDataObserver(filterValue: EpicSvtTestsGridDsFilter, force: boolean): Observable<EpicSvtTestsGrid.RowEntity[]> {
        return forkJoin({
            tests: this.epicSvtTestsApiClient.fetchList(filterValue),
            testSetupConfigs: this.epicSvtTestSetupConfigsDataFacade.fetchData(),
            testTypeConfigs: this.epicSvtTestTypeConfigsDataFacade.fetchData(),
        })
            .pipe(
                map(({ tests, testSetupConfigs, testTypeConfigs }) => {
                    const testSetupConfigsMap = keyBy(testSetupConfigs, 'id')
                    const testTypeConfigsMap = keyBy(testTypeConfigs, 'id')

                    return tests
                        .map(item => ({
                            ...item,
                            testTypeConfig: testTypeConfigsMap[item.testTypeConfigId] || null,
                            testSetupConfig: testSetupConfigsMap[item.testSetupConfigId] || null,
                        } satisfies EpicSvtTestsGrid.RowEntity))
                }),
            )
    }

}
