import { inject, Injectable } from '@angular/core'
import { EpicSvtTestType, EpicSvtTestTypesApiClient } from 'epic-ui/api'
import { BaseCachedDataFacade } from 'epic-ui/utils'
import { Observable } from 'rxjs'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTypesDataFacade extends BaseCachedDataFacade<EpicSvtTestType[]> {

    protected readonly epicSvtTestTypesApiClient = inject(EpicSvtTestTypesApiClient)

    protected _fetchData(force: boolean | undefined): Observable<EpicSvtTestType[]> {
        return this.epicSvtTestTypesApiClient.fetchList()
    }

}

