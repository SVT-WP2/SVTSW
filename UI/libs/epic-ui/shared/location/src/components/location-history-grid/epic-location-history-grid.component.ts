import { Component, Input } from '@angular/core'
import { AgGridAngular } from 'ag-grid-angular'
import { AgGridCellEventDirective } from 'epic-ui/common/ag-grid'
import { EpicLoaderComponent, EpicContentErrorModule } from 'epic-ui/common/components'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import { EpicLocationHistoryGrid } from './epic-location-history-grid.models'

import Grid = EpicLocationHistoryGrid


@Component({
    selector: 'epic-location-history-grid',
    templateUrl: './epic-location-history-grid.component.html',
    imports: [
        AgGridAngular,
        AgGridCellEventDirective,
        EpicLoaderComponent,
        EpicContentErrorModule,
    ],
})
export class EpicLocationHistoryGridComponent extends BaseComponent {

    @Input({ required: true }) data!: Grid.RowEntity[]
    @Input() initProcessing: ProcessingStore.EventProcessingState = ProcessingStore.getDefaultProcessingState()

    @Input() colDefs = Grid.getColDefs()
    @Input() gridOptions = Grid.getGridOptions()

}
