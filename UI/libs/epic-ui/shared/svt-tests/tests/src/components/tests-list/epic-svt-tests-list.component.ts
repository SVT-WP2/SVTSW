import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicSvtTestsGrid } from '../../models'

import Grid = EpicSvtTestsGrid


@Component({
    selector: 'epic-svt-tests-list',
    templateUrl: 'epic-svt-tests-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicSvtTestsListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: Grid.RowEntity[]

    @Output() rowClicked$ = new EventEmitter<Grid.RowEntity>()
    @Output() details$ = new EventEmitter<Grid.RowEntity>()

    readonly colDefs = Grid.getColDefs()
    readonly gridOptions = Grid.getGridOptions()

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<Grid.CellEventEvent, any, Grid.RowEntity>): void {
        switch (event.eventName) {
            case Grid.CellEventEvent.Details:
                this.details$.emit(event.rowData)
                break
            default:
            // DO NOTHING
        }
    }

    onRowClicked(rowData: Grid.RowEntity): void {
        this.rowClicked$.emit(rowData)
    }

}
