import { inject, Injectable } from '@angular/core'
import { EpicSvtTestTypeConfigsDataFacade, EpicSvtTestTypesDataFacade } from 'epic-ui/shared/svt-test/test-types'
import { EpicSvtTestSetupConfigsDataFacade, EpicSvtTestSetupsDataFacade } from 'epic-ui/shared/svt-tests'
import { SimpleDataSource } from 'epic-ui/utils'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicSvtTestsListFilterData } from '../models'


/**
 * Options of the test type and config filters. All three facades are cached, so this costs nothing on top of
 * the decoration the grid data source already does.
 */
@Injectable({ providedIn: 'root' })
export class EpicSvtTestsListFilterDataSource extends SimpleDataSource<EpicSvtTestsListFilterData> {

    protected readonly epicSvtTestSetupConfigsDataFacade = inject(EpicSvtTestSetupConfigsDataFacade)
    protected readonly epicSvtTestSetupsDataFacade = inject(EpicSvtTestSetupsDataFacade)
    protected readonly epicSvtTestTypeConfigsDataFacade = inject(EpicSvtTestTypeConfigsDataFacade)
    protected readonly epicSvtTestTypesDataFacade = inject(EpicSvtTestTypesDataFacade)

    protected override getDataObserver(
        filterValue: Record<string, any>, force: boolean): Observable<EpicSvtTestsListFilterData> {

        return forkJoin({
            testSetupConfigs: this.epicSvtTestSetupConfigsDataFacade.fetchData(force),
            testSetups: this.epicSvtTestSetupsDataFacade.fetchData(force),
            testTypeConfigs: this.epicSvtTestTypeConfigsDataFacade.fetchData(force),
            testTypes: this.epicSvtTestTypesDataFacade.fetchData(force),
        })
            .pipe(
                map(({ testSetupConfigs, testSetups, testTypeConfigs, testTypes }) => ({
                    testTypeSelectOptions: testTypes
                        .map(item => ({ value: item.id, label: item.name })),
                    testTypeConfigSelectOptions: testTypeConfigs
                        .map(item => ({ value: item.id, label: item.name })),
                    testSetupSelectOptions: testSetups
                        .map(item => ({ value: item.id, label: item.name })),
                    testSetupConfigSelectOptions: testSetupConfigs
                        .map(item => ({ value: item.id, label: item.name })),
                    testTypeConfigIdsByTestTypeId: toConfigIdsByOwnerId(testTypeConfigs, 'testTypeId'),
                    testSetupConfigIdsByTestSetupId: toConfigIdsByOwnerId(testSetupConfigs, 'setupId'),
                })),
            )
    }

}

/** Groups config ids under the id of the test type / test setup they belong to. */
function toConfigIdsByOwnerId<TConfig extends { id: number }>(
    configs: TConfig[], ownerIdKey: keyof TConfig): Record<number, number[]> {

    return configs.reduce<Record<number, number[]>>(
        (acc, item) => {
            const ownerId = item[ownerIdKey] as number

            return {
                ...acc,
                [ownerId]: [...(acc[ownerId] || []), item.id],
            }
        },
        {},
    )
}
