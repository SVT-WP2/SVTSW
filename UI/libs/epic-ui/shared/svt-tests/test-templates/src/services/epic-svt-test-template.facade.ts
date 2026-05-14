import { inject, Injectable } from '@angular/core'
import { EpicSvtTestTemplate, EpicSvtTestTemplatesApiClient } from 'epic-ui/api'
import { BaseCachedDataFacade } from 'epic-ui/utils'
import { Observable } from 'rxjs'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTemplateFacade extends BaseCachedDataFacade<EpicSvtTestTemplate[]> {

    protected readonly epicSvtTestTemplatesApiClient = inject(EpicSvtTestTemplatesApiClient)

    protected _fetchData(force: boolean | undefined): Observable<EpicSvtTestTemplate[]> {
        return this.epicSvtTestTemplatesApiClient.fetchList()
    }

}

