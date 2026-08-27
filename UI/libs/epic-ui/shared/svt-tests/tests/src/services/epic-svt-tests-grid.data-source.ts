import { inject, Injectable } from '@angular/core'
import { EpicApiPager, EpicApiPageResponse, EpicSvtTestsApiClient, EpicSvtTestsListQuery } from 'epic-ui/api'
import { EpicAgGridInfiniteDataSource } from 'epic-ui/common/ag-grid'
import { EpicSvtTestTypeConfigsDataFacade, EpicSvtTestTypesDataFacade } from 'epic-ui/shared/svt-test/test-types'
import { EpicSvtTestSetupConfigsDataFacade, EpicSvtTestSetupsDataFacade } from 'epic-ui/shared/svt-tests'
import { keyBy } from 'lodash-es'
import { forkJoin, map, Observable, of } from 'rxjs'

import { EpicSvtTestsGrid } from '../models'


export type EpicSvtTestsGridDsFilter = EpicSvtTestsListQuery.QueryFilter

@Injectable({ providedIn: 'root' })
export class EpicSvtTestsGridDataSource
    extends EpicAgGridInfiniteDataSource<EpicSvtTestsGrid.RowEntity, EpicSvtTestsGridDsFilter> {

    protected readonly epicSvtTestsApiClient = inject(EpicSvtTestsApiClient)
    protected readonly epicSvtTestSetupConfigsDataFacade = inject(EpicSvtTestSetupConfigsDataFacade)
    protected readonly epicSvtTestSetupsDataFacade = inject(EpicSvtTestSetupsDataFacade)
    protected readonly epicSvtTestTypeConfigsDataFacade = inject(EpicSvtTestTypeConfigsDataFacade)
    protected readonly epicSvtTestTypesDataFacade = inject(EpicSvtTestTypesDataFacade)

    constructor() {
        super()
    }

    /**
     * Only the tests themselves are paginated — the config and test type lists are cached facades, so every
     * block after the first one is a single API call.
     */
    protected fetchDataBlock(
        pager: EpicApiPager, filter: EpicSvtTestsGridDsFilter): Observable<EpicApiPageResponse<EpicSvtTestsGrid.RowEntity>> {

        // an explicit but empty list of config ids means no config can satisfy the filter, so nothing matches —
        // passing it on would read as "any config" and bring the whole list back (see toEpicSvtTestsListQueryFilter)
        const hasImpossibleConfigFilter = (filter.testTypeConfigIds && !filter.testTypeConfigIds.length)
            || (filter.testSetupConfigIds && !filter.testSetupConfigIds.length)

        if (hasImpossibleConfigFilter) {
            return of({ items: [], totalCount: 0 })
        }

        return forkJoin({
            tests: this.epicSvtTestsApiClient.fetchList(filter, pager),
            testSetupConfigs: this.epicSvtTestSetupConfigsDataFacade.fetchData(),
            testSetups: this.epicSvtTestSetupsDataFacade.fetchData(),
            testTypeConfigs: this.epicSvtTestTypeConfigsDataFacade.fetchData(),
            testTypes: this.epicSvtTestTypesDataFacade.fetchData(),
        })
            .pipe(
                map(({ tests, testSetupConfigs, testSetups, testTypeConfigs, testTypes }) => {
                    const testSetupConfigsMap = keyBy(testSetupConfigs, 'id')
                    const testSetupsMap = keyBy(testSetups, 'id')
                    const testTypeConfigsMap = keyBy(testTypeConfigs, 'id')
                    const testTypesMap = keyBy(testTypes, 'id')

                    return {
                        items: tests.items
                            .map((item) => {
                                // the test only knows its configs, the type and setup they belong to come with them
                                const testTypeConfig = testTypeConfigsMap[item.testTypeConfigId] || null
                                const testSetupConfig = testSetupConfigsMap[item.testSetupConfigId] || null

                                return {
                                    ...item,
                                    testType: testTypeConfig ? testTypesMap[testTypeConfig.testTypeId] || null : null,
                                    testTypeConfig,
                                    testSetup: testSetupConfig ? testSetupsMap[testSetupConfig.setupId] || null : null,
                                    testSetupConfig,
                                } satisfies EpicSvtTestsGrid.RowEntity
                            }),
                        totalCount: tests.totalCount,
                    }
                }),
            )
    }

}
