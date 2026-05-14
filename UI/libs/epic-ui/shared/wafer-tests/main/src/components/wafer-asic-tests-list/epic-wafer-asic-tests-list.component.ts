import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { RowClickedEvent } from 'ag-grid-community'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicWaferAsicTestsListGrid } from '../../models'

import Grid = EpicWaferAsicTestsListGrid
import CellEventEvent = EpicWaferAsicTestsListGrid.CellEventEvent
import RowEntity = EpicWaferAsicTestsListGrid.RowEntity


@Component({
    selector: 'epic-wafer-asic-tests-list',
    templateUrl: 'epic-wafer-asic-tests-list.component.html',
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicWaferAsicTestsListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: RowEntity[]

    @Output() rowClicked$ = new EventEmitter<RowEntity>()
    @Output() clone$ = new EventEmitter<RowEntity>()
    @Output() details$ = new EventEmitter<RowEntity>()

    readonly colDefs = Grid.getColDefs()
    readonly gridOptions = Grid.getGridOptions()

    onRowClicked(event: RowClickedEvent<RowEntity>) {
        this.rowClicked$.emit(event.data)
    }

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<Grid.CellEventEvent, any, RowEntity>): void {
        switch (event.eventName) {
            case CellEventEvent.Details:
                this.details$.emit(event.rowData)
                break

            case CellEventEvent.Repeat:
                this.clone$.emit(event.rowData)
                break

            default:
            // DO NOTHING
        }
    }

}
