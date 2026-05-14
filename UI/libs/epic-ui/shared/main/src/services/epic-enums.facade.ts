import { inject, Injectable } from '@angular/core'
import { EpicEnumName, EpicEnumsApiClient, EpicEnumsCollection } from 'epic-ui/api'
import { BaseCachedDataFacade } from 'epic-ui/utils'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'


@Injectable({ providedIn: 'root' })
export class EpicEnumsFacade extends BaseCachedDataFacade<EpicEnumsCollection> {

    protected readonly epicEnumsApiClient = inject(EpicEnumsApiClient)

    fetchByEnumName(enumName: EpicEnumName, force?: boolean): Observable<string[]> {
        return this.fetchData(force)
            .pipe(
                map(data => data[enumName] || []),
            )
    }

    protected _fetchData(force: boolean | undefined): Observable<EpicEnumsCollection> {
        return this.epicEnumsApiClient.fetchAll()
    }

}
