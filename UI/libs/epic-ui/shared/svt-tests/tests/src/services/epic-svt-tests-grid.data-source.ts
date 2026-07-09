import { inject, Injectable } from '@angular/core'
import { EpicSvtTestsApiClient, EpicSvtTestsListQuery } from 'epic-ui/api'
import { SimpleDataSource } from 'epic-ui/utils'
import { Observable } from 'rxjs'

import { EpicSvtTestsGrid } from '../models'


export type EpicSvtTestsGridDsFilter = EpicSvtTestsListQuery.QueryFilter

@Injectable({ providedIn: 'root' })
export class EpicSvtTestsGridDataSource extends SimpleDataSource<EpicSvtTestsGrid.RowEntity[], EpicSvtTestsGridDsFilter> {

    protected readonly epicSvtTestsApiClient = inject(EpicSvtTestsApiClient)

    protected override getDataObserver(filterValue: EpicSvtTestsGridDsFilter, force: boolean): Observable<EpicSvtTestsGrid.RowEntity[]> {
        return this.epicSvtTestsApiClient.fetchList(filterValue)
    }

}
