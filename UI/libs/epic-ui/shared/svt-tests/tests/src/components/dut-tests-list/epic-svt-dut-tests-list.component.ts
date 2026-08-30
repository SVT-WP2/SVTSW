import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { RowClickedEvent } from 'ag-grid-community'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicSvtTestsGrid } from '../../models'

import Grid = EpicSvtTestsGrid


@Component({
    selector: 'epic-svt-dut-tests-list',
    templateUrl: 'epic-svt-dut-tests-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicSvtDutTestsListComponent extends BaseComponent {

    /** Every test of the DUT, already narrowed down by the filter bar — see `EpicSvtDutTestsDataSource`. */
    @Input({ required: true }) entitiesList: Grid.RowEntity[] = []

    @Output() rowClicked$ = new EventEmitter<Grid.RowEntity>()
    @Output() details$ = new EventEmitter<Grid.RowEntity>()

    // the page already is one single DUT, so both DUT columns would repeat the same value in every row
    readonly colDefs = Grid.getColDefs({
        excludeColIds: [Grid.ColId.dutEntityName, Grid.ColId.dutId],
    })
    readonly gridOptions = Grid.getClientSideGridOptions()

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<Grid.CellEventEvent, any, Grid.RowEntity>): void {
        switch (event.eventName) {
            case Grid.CellEventEvent.Details:
                this.details$.emit(event.rowData)
                break
            default:
            // DO NOTHING
        }
    }

    onRowClicked(event: RowClickedEvent<Grid.RowEntity>): void {
        this.rowClicked$.emit(event.data)
    }

}
