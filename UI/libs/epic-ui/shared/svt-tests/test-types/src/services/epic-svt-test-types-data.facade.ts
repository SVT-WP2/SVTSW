import { inject, Injectable } from '@angular/core'
import { EpicSvtTestTypesApiClient } from 'epic-ui/api'
import { BaseCachedDataFacade } from 'epic-ui/utils'
import { Observable } from 'rxjs'
import { EpicSvtTestType } from 'svt-ts-types'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTypesDataFacade extends BaseCachedDataFacade<EpicSvtTestType[]> {

    protected readonly epicSvtTestTypesApiClient = inject(EpicSvtTestTypesApiClient)

    protected _fetchData(force: boolean | undefined): Observable<EpicSvtTestType[]> {
        return this.epicSvtTestTypesApiClient.fetchList()
    }

}

