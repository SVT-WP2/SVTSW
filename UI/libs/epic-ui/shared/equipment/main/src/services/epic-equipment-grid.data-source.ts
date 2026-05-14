import { inject, Injectable } from '@angular/core'
import { EpicEquipmentTypesFacade } from 'epic-ui/shared/equipment-types'
import { SimpleDataSource } from 'epic-ui/utils'
import { forkJoin, map, Observable } from 'rxjs'

import { EpicEquipmentGrid } from '../models'

import { EpicEquipmentFacade } from './epic-equipment.facade'


@Injectable({ providedIn: 'root' })
export class EpicEquipmentGridDataSource extends SimpleDataSource<EpicEquipmentGrid.RowEntity[]> {

    protected readonly epicEquipmentFacade = inject(EpicEquipmentFacade)
    protected readonly epicEquipmentTypesFacade = inject(EpicEquipmentTypesFacade)

    protected override getDataObserver(filterValue: unknown, force: boolean): Observable<EpicEquipmentGrid.RowEntity[]> {
        return forkJoin({
            equipmentList: this.epicEquipmentFacade.fetchData(force),
            equipmentTypes: this.epicEquipmentTypesFacade.fetchData(force),
        })
            .pipe(
                map(({ equipmentList, equipmentTypes }) => {
                    return equipmentList.map<EpicEquipmentGrid.RowEntity>( item => ({
                        ...item,
                        equipmentType: equipmentTypes.find(itemType => itemType.id === item.equipmentTypeId),
                    }))
                }),
            )
    }

}
