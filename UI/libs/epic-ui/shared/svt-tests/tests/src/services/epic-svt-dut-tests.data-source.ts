import { inject, Injectable } from '@angular/core'
import { EpicSvtDutEntityName, EpicSvtTestsApiClient } from 'epic-ui/api'
import { EpicSvtTestTypeConfigsDataFacade, EpicSvtTestTypesDataFacade } from 'epic-ui/shared/svt-test/test-types'
import { EpicSvtTestSetupConfigsDataFacade, EpicSvtTestSetupsDataFacade } from 'epic-ui/shared/svt-tests'
import { SimpleDataSource } from 'epic-ui/utils'
import { forkJoin, map, Observable, of } from 'rxjs'

import { EPIC_SVT_DUT_TESTS_PAGE_SIZE, EpicSvtTestsGrid } from '../models'


export type EpicSvtDutTestsDsFilter = {
    dutEntityName: EpicSvtDutEntityName | null
    /** DUT ids are unique per DUT entity only, so it is always paired with the entity name above. */
    dutId: number | null
}

/**
 * Every test of one single DUT, in one go. Unlike the global list this one is not paginated: the statistics
 * shown next to the grid are about the whole history of the DUT, which no single page of it could answer.
 *
 * Meant to be provided by the component showing it rather than in the root injector — a DUT page owns its own
 * instance, and disconnecting it in `ngOnDestroy` drops whatever request is still on its way.
 */
@Injectable()
export class EpicSvtDutTestsDataSource extends SimpleDataSource<EpicSvtTestsGrid.RowEntity[], EpicSvtDutTestsDsFilter> {

    protected readonly epicSvtTestsApiClient = inject(EpicSvtTestsApiClient)
    protected readonly epicSvtTestSetupConfigsDataFacade = inject(EpicSvtTestSetupConfigsDataFacade)
    protected readonly epicSvtTestSetupsDataFacade = inject(EpicSvtTestSetupsDataFacade)
    protected readonly epicSvtTestTypeConfigsDataFacade = inject(EpicSvtTestTypeConfigsDataFacade)
    protected readonly epicSvtTestTypesDataFacade = inject(EpicSvtTestTypesDataFacade)

    protected override getDataObserver(
        filterValue: EpicSvtDutTestsDsFilter, force: boolean): Observable<EpicSvtTestsGrid.RowEntity[]> {

        // without a DUT there is nothing to ask for — the page is still waiting for the entity it belongs to
        if (!filterValue.dutEntityName || !filterValue.dutId) {
            return of([])
        }

        return forkJoin({
            tests: this.epicSvtTestsApiClient.fetchAllList(
                {
                    dutEntityNames: [filterValue.dutEntityName],
                    dutId: filterValue.dutId,
                },
                EPIC_SVT_DUT_TESTS_PAGE_SIZE,
            ),
            testSetupConfigs: this.epicSvtTestSetupConfigsDataFacade.fetchData(force),
            testSetups: this.epicSvtTestSetupsDataFacade.fetchData(force),
            testTypeConfigs: this.epicSvtTestTypeConfigsDataFacade.fetchData(force),
            testTypes: this.epicSvtTestTypesDataFacade.fetchData(force),
        })
            .pipe(
                map(({ tests, ...relations }) => EpicSvtTestsGrid.toRowEntities(tests, relations)),
            )
    }

}
