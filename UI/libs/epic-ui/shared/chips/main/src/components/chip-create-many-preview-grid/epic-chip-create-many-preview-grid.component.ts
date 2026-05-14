import { Component, input } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { AgIconActionsCellModule } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicChipCreateManyPreviewGrid } from '../../models'

import Grid = EpicChipCreateManyPreviewGrid


@Component({
    selector: 'epic-chip-create-many-preview-grid',
    templateUrl: 'epic-chip-create-many-preview-grid.component.html',
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
    ],
})
export class EpicChipCreateManyPreviewGridComponent extends BaseComponent {

    readonly entities = input.required<Grid.RowEntity[]>()

    readonly colDefs = Grid.getColDefs()
    readonly gridOptions = Grid.getGridOptions()

}
