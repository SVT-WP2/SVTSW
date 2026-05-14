import { inject, Injectable } from '@angular/core'
import { EpicAsicTestType, EpicAsicTestTypesApiClient } from 'epic-ui/api'
import { BaseEntitiesListCachedFacade } from 'epic-ui/utils'
import { Observable } from 'rxjs'


@Injectable({ providedIn: 'root' })
export class EpicAsicTestTypesFacade extends BaseEntitiesListCachedFacade<EpicAsicTestType> {

    protected readonly epicAsicTestTypesApiClient = inject(EpicAsicTestTypesApiClient)

    protected override fetchEntitiesList(): Observable<EpicAsicTestType[]> {
        return this.epicAsicTestTypesApiClient.fetchAll()
    }

}
