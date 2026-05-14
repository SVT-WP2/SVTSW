import { inject, Injectable } from '@angular/core'
import { SimpleDataSource } from 'epic-ui/utils'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicSvtTestSetupsGrid } from '../models'

import { EpicSvtTestSetupConfigsDataFacade } from './epic-svt-test-setup-configs-data.facade'
import { EpicSvtTestSetupsDataFacade } from './epic-svt-test-setups-data.facade'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupsGridDataSource extends SimpleDataSource<EpicSvtTestSetupsGrid.RowEntity[]> {

    protected readonly epicSvtTestSetupFacade = inject(EpicSvtTestSetupsDataFacade)
    protected readonly epicSvtTestSetupConfigsDataFacade = inject(EpicSvtTestSetupConfigsDataFacade)

    protected override getDataObserver(filterValue: unknown, force: boolean): Observable<EpicSvtTestSetupsGrid.RowEntity[]> {
        return forkJoin({
            svtTestSetupList: this.epicSvtTestSetupFacade.fetchData(force),
            // TODO: implement after implementing SvtTestSetupType entity and its facade
            // SvtTestSetupTypes: this.epicSvtTestSetupTypesFacade.fetchData(force),
        })
            .pipe(
                map(({ svtTestSetupList }) => {
                    return svtTestSetupList.map<EpicSvtTestSetupsGrid.RowEntity>(item => ({
                        ...item,
                        // TODO: implement after implementing SvtTestSetupType entity and its facade
                        // SvtTestSetupType: SvtTestSetupTypes.find(itemType => itemType.id === item.SvtTestSetupTypeId),
                    }))
                }),
            )
    }

}
