import { inject, Injectable } from '@angular/core'
import { SimpleDataSource } from 'epic-ui/utils'
import { Observable } from 'rxjs'
import { EpicEquipmentType } from 'svt-ts-types'

import { EpicEquipmentTypesFacade } from './epic-equipment-types.facade'


@Injectable({ providedIn: 'root' })
export class EpicEquipmentTypesDataSource extends SimpleDataSource<EpicEquipmentType[]> {

    protected readonly epicEquipmentTypesFacade = inject(EpicEquipmentTypesFacade)

    protected override getDataObserver(filterValue: unknown, force: boolean): Observable<EpicEquipmentType[]> {
        return this.epicEquipmentTypesFacade.fetchData(force)
    }

}
