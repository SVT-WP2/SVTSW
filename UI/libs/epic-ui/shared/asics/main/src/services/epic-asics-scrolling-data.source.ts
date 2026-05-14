import { inject, Injectable } from '@angular/core'
import { EpicApiPager, EpicAsic, EpicAsicsApiClient } from 'epic-ui/api'
import { EpicBaseScrollingDataSource, EpicScrollData } from 'epic-ui/common/components'
import { map, Observable } from 'rxjs'


export type EpicAsicsScrollingDsFilter = {
    waferId: number | null | undefined
    asicFamilyType: string | null
    asicQuality: string | null
    serialNumber: string | null
}

@Injectable({providedIn: 'root'})
export class EpicAsicsScrollingDataSource extends EpicBaseScrollingDataSource<EpicAsic, EpicAsicsScrollingDsFilter> {

    protected readonly epicAsicsApiClient = inject(EpicAsicsApiClient)

    constructor() {
        super({
            batchSize: 100,
        })
    }

    protected processFetchDataBatch(
        pager: EpicApiPager, filter: EpicAsicsScrollingDsFilter): Observable<EpicScrollData<EpicAsic>> {

        return this.epicAsicsApiClient.fetchAsicsList(filter, pager)
            .pipe(
                map(result => ({
                    records: result.items,
                    totalCount: result.totalCount,
                    hasMoreItems: result.totalCount > pager.offset + pager.limit,
                })),
            )

    }

}
