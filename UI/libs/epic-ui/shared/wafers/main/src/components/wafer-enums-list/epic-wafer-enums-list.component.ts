import { Component, Input } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { AgGridCellEventDirective, AgIconActionsCellModule } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicWaferEnumsGrid } from '../../models'

import Grid = EpicWaferEnumsGrid


@Component({
    selector: 'epic-wafer-enums-list',
    templateUrl: 'epic-wafer-enums-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicWaferEnumsListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: Grid.RowEntity[]

    readonly colDefs = Grid.getColDefs()
    readonly gridOptions = Grid.getGridOptions()

}
