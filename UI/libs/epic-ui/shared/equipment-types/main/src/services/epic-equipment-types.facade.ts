import { inject, Injectable } from '@angular/core'
import { EpicEquipmentType } from 'epic-api-types'
import { EpicEquipmentTypesApiClient } from 'epic-ui/api'
import { BaseCachedDataFacade } from 'epic-ui/utils'
import { Observable } from 'rxjs'


@Injectable({ providedIn: 'root' })
export class EpicEquipmentTypesFacade extends BaseCachedDataFacade<EpicEquipmentType[]> {

    protected readonly epicEquipmentTypeApiClient = inject(EpicEquipmentTypesApiClient)

    protected _fetchData(force: boolean | undefined): Observable<EpicEquipmentType[]> {
        return this.epicEquipmentTypeApiClient.fetchList()
    }

}
