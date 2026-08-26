import { inject, Injectable } from '@angular/core'
import { EpicApiPager, EpicChipBlock, EpicChipBlocksApiClient } from 'epic-ui/api'
import { EpicBaseScrollingDataSource, EpicScrollData } from 'epic-ui/common/components'
import { map, Observable } from 'rxjs'


export type EpicChipBlocksScrollingDsFilter = {
    chipId: number | null
    chipBlockTypes: string[] | null
    serialNumber: string | null
}

@Injectable({ providedIn: 'root' })
export class EpicChipBlocksScrollingDataSource
    extends EpicBaseScrollingDataSource<EpicChipBlock, EpicChipBlocksScrollingDsFilter> {

    protected readonly epicChipBlocksApiClient = inject(EpicChipBlocksApiClient)

    constructor() {
        super({
            batchSize: 100,
        })
    }

    protected processFetchDataBatch(
        pager: EpicApiPager, filter: EpicChipBlocksScrollingDsFilter): Observable<EpicScrollData<EpicChipBlock>> {

        return this.epicChipBlocksApiClient.fetchList(filter, pager)
            .pipe(
                map(result => ({
                    records: result.items,
                    totalCount: result.totalCount,
                    hasMoreItems: result.totalCount > pager.offset + pager.limit,
                })),
            )
    }

}
