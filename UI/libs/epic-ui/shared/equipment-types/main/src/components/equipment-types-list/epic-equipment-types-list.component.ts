import { Component, Input } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { AgGridCellEventDirective, AgIconActionsCellModule } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'
import { EpicEquipmentType } from 'svt-ts-types'

import { EpicEquipmentTypesGrid } from '../../models'


@Component({
    selector: 'epic-equipment-types-list',
    templateUrl: 'epic-equipment-types-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicEquipmentTypesListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: EpicEquipmentType[]

    readonly colDefs = EpicEquipmentTypesGrid.getColDefs()
    readonly gridOptions = EpicEquipmentTypesGrid.getGridOptions()

}
