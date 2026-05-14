import { Component, Input } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { EpicIvMnt } from 'epic-ui/api'
import { AgIconActionsCellModule } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicIvMntListGrid } from '../../models'


@Component({
    selector: 'epic-iv-mnt-grid',
    templateUrl: 'epic-iv-mnt-grid.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
    ],
})
export class EpicIvMntGridComponent extends BaseComponent {

    @Input({ required: true }) entities: EpicIvMnt[]

    readonly colDefs = EpicIvMntListGrid.getColDefs()
    readonly gridOptions = EpicIvMntListGrid.getGridOptions()

}
