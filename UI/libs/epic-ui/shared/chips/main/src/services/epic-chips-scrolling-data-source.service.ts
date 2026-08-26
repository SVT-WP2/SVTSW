import { inject, Injectable } from '@angular/core'
import { EpicApiPager, EpicChip, EpicChipsApiClient } from 'epic-ui/api'
import { EpicBaseScrollingDataSource, EpicScrollData } from 'epic-ui/common/components'
import { map, Observable } from 'rxjs'


export type EpicChipsScrollingDsFilter = {
    familyTypes: string[] | null
    generalLocation: string | null
    serialNumber: string | null
}

@Injectable({providedIn: 'root'})
export class EpicChipsScrollingDataSource extends EpicBaseScrollingDataSource<EpicChip, EpicChipsScrollingDsFilter> {

    protected readonly epicChipsApiClient = inject(EpicChipsApiClient)

    constructor() {
        super({
            batchSize: 100,
        })
    }

    protected processFetchDataBatch(
        pager: EpicApiPager, filter: EpicChipsScrollingDsFilter): Observable<EpicScrollData<EpicChip>> {

        return this.epicChipsApiClient.fetchChipsList(filter, pager)
            .pipe(
                map(result => ({
                    records: result.items,
                    totalCount: result.totalCount,
                    hasMoreItems: result.totalCount > pager.offset + pager.limit,
                })),
            )

    }

}
