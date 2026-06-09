import { inject, Injectable } from '@angular/core'
import { EpicEquipment, EpicEquipmentApiClient } from 'epic-ui/api'
import { BaseCachedDataFacade } from 'epic-ui/utils'
import { Observable } from 'rxjs'


@Injectable({ providedIn: 'root' })
export class EpicEquipmentFacade extends BaseCachedDataFacade<EpicEquipment[]> {

    protected readonly epicEquipmentApiClient = inject(EpicEquipmentApiClient)

    protected _fetchData(force: boolean | undefined): Observable<EpicEquipment[]> {
        return this.epicEquipmentApiClient.fetchList()
    }

}
