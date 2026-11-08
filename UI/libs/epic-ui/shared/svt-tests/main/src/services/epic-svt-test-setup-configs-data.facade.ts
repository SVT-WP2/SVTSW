import { inject, Injectable } from '@angular/core'
import { EpicSvtTestSetupConfigsApiClient } from 'epic-ui/api'
import { BaseCachedDataFacade } from 'epic-ui/utils'
import { Observable } from 'rxjs'
import { EpicSvtTestSetupConfig } from 'svt-ts-types'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupConfigsDataFacade extends BaseCachedDataFacade<EpicSvtTestSetupConfig[]> {

    protected readonly epicSvtTestSetupConfigsApiClient = inject(EpicSvtTestSetupConfigsApiClient)

    protected _fetchData(force: boolean | undefined): Observable<EpicSvtTestSetupConfig[]> {
        return this.epicSvtTestSetupConfigsApiClient.fetchList()
    }

}
