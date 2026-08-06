import { inject, Injectable } from '@angular/core'
import { EpicChipBlock, EpicChipBlocksApiClient } from 'epic-ui/api'
import { BaseEntitiesListCachedFacade } from 'epic-ui/utils'
import { Observable } from 'rxjs'


/**
 * `GetAllChipBlocks` offers no serial number filter (see the Kafka contract), so a chip block list cannot be
 * searched server side the way ASICs and chips are. The full list is fetched once and cached here instead;
 * callers narrow it down themselves.
 */
@Injectable({ providedIn: 'root' })
export class EpicChipBlocksFacade extends BaseEntitiesListCachedFacade<EpicChipBlock> {

    protected readonly epicChipBlocksApiClient = inject(EpicChipBlocksApiClient)

    protected fetchEntitiesList(): Observable<EpicChipBlock[]> {
        return this.epicChipBlocksApiClient.fetchList()
    }

}
