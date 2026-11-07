import { inject, Injectable } from '@angular/core'
import { EpicSvtTestSetupConfig } from 'epic-api-types'
import { EpicSvtTestSetupConfigsApiClient } from 'epic-ui/api'
import { BaseCachedDataFacade } from 'epic-ui/utils'
import { Observable } from 'rxjs'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupConfigsDataFacade extends BaseCachedDataFacade<EpicSvtTestSetupConfig[]> {

    protected readonly epicSvtTestSetupConfigsApiClient = inject(EpicSvtTestSetupConfigsApiClient)

    protected _fetchData(force: boolean | undefined): Observable<EpicSvtTestSetupConfig[]> {
        return this.epicSvtTestSetupConfigsApiClient.fetchList()
    }

}
