import { inject, Injectable } from '@angular/core'
import { EpicApiPager, EpicApiPageResponse, EpicSvtTestsListQuery } from 'epic-api-types'
import { EpicSvtTestsApiClient } from 'epic-ui/api'
import { EpicAgGridInfiniteDataSource } from 'epic-ui/common/ag-grid'
import { EpicSvtTestTypeConfigsDataFacade, EpicSvtTestTypesDataFacade } from 'epic-ui/shared/svt-test/test-types'
import { EpicSvtTestSetupConfigsDataFacade, EpicSvtTestSetupsDataFacade } from 'epic-ui/shared/svt-tests'
import { forkJoin, map, Observable, of } from 'rxjs'

import { EpicSvtTestsGrid } from '../models'


export type EpicSvtTestsGridDsFilter = EpicSvtTestsListQuery

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

        // an explicit but empty list of ids (a search term that is no id) or of config ids (an owner without
        // configs) means nothing can satisfy the filter — passing it on would read as "any" and bring the whole
        // list back (see toEpicSvtTestsListQueryFilter)
        const hasImpossibleFilter = (filter.ids && !filter.ids.length)
            || (filter.testTypeConfigIds && !filter.testTypeConfigIds.length)
            || (filter.testSetupConfigIds && !filter.testSetupConfigIds.length)

        if (hasImpossibleFilter) {
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
                map(({ tests, ...relations }) => ({
                    items: EpicSvtTestsGrid.toRowEntities(tests.items, relations),
                    totalCount: tests.totalCount,
                })),
            )
    }

}
