import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { RowClickedEvent } from 'ag-grid-community'
import { EpicWafer } from 'epic-ui/api'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicWafersGrid } from '../../models'

import CellEventEvent = EpicWafersGrid.CellEventEvent


@Component({
    selector: 'epic-wafers-list',
    templateUrl: 'epic-wafers-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicWafersListComponent extends BaseComponent {

    @Input({ required: true }) wafers!: EpicWafer[]

    @Output() rowClicked$ = new EventEmitter<EpicWafer>()
    @Output() edit$ = new EventEmitter<EpicWafer>()
    @Output() clone$ = new EventEmitter<EpicWafer>()
    @Output() delete$ = new EventEmitter<EpicWafer>()

    readonly colDefs = EpicWafersGrid.getColDefs()
    readonly gridOptions = EpicWafersGrid.getGridOptions()

    onRowClicked(event: RowClickedEvent<EpicWafer>) {
        this.rowClicked$.emit(event.data)
    }

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<EpicWafersGrid.CellEventEvent, any, EpicWafer>): void {
        switch (event.eventName) {
            case CellEventEvent.Delete:
                this.delete$.emit(event.rowData)
                break

            case CellEventEvent.Clone:
                this.clone$.emit(event.rowData)
                break

            case CellEventEvent.Edit:
                this.edit$.emit(event.rowData)
                break

            default:
                // DO NOTHING
        }
    }

}
