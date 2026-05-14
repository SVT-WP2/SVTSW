import { inject, Injectable } from '@angular/core'
import { EpicSvtTestTypeConfig, EpicSvtTestTypeConfigsApiClient } from 'epic-ui/api'
import { BaseCachedDataFacade } from 'epic-ui/utils'
import { Observable } from 'rxjs'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTypeConfigsDataFacade extends BaseCachedDataFacade<EpicSvtTestTypeConfig[]> {

    protected readonly epicSvtTestTypeConfigsApiClient = inject(EpicSvtTestTypeConfigsApiClient)

    protected _fetchData(force: boolean | undefined): Observable<EpicSvtTestTypeConfig[]> {
        return this.epicSvtTestTypeConfigsApiClient.fetchList()
    }

}

