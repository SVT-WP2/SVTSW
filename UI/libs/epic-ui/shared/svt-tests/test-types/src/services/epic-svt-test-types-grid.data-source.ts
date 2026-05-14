import { inject, Injectable } from '@angular/core'
import { SimpleDataSource } from 'epic-ui/utils'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicSvtTestTypesGrid } from '../models'

import { EpicSvtTestTypesDataFacade } from './epic-svt-test-types-data.facade'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTypesGridDataSource extends SimpleDataSource<EpicSvtTestTypesGrid.RowEntity[]> {

    protected readonly epicSvtTestTypesFacade = inject(EpicSvtTestTypesDataFacade)

    protected override getDataObserver(filterValue: unknown, force: boolean): Observable<EpicSvtTestTypesGrid.RowEntity[]> {
        return forkJoin({
            svtTestTypeList: this.epicSvtTestTypesFacade.fetchData(force),
        })
            .pipe(
                map(({ svtTestTypeList }) => {
                    return svtTestTypeList.map<EpicSvtTestTypesGrid.RowEntity>(item => ({
                        ...item,
                    }))
                }),
            )
    }

}

