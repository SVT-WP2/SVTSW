import { inject, Injectable } from '@angular/core'
import { EpicSvtTestSetupsApiClient } from 'epic-ui/api'
import { BaseCachedDataFacade } from 'epic-ui/utils'
import { Observable } from 'rxjs'
import { EpicSvtTestSetup } from 'svt-ts-types'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupsDataFacade extends BaseCachedDataFacade<EpicSvtTestSetup[]> {

    protected readonly epicSvtTestSetupApiClient = inject(EpicSvtTestSetupsApiClient)

    protected _fetchData(force: boolean | undefined): Observable<EpicSvtTestSetup[]> {
        return this.epicSvtTestSetupApiClient.fetchList()
    }

}
