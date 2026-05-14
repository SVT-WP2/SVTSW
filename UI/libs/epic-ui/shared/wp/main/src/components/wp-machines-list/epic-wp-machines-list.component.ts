import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { RowClickedEvent } from 'ag-grid-community'
import { EpicWpMachine } from 'epic-ui/api'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicWpMachinesGrid } from '../../models'

import CellEventEvent = EpicWpMachinesGrid.CellEventEvent


@Component({
    selector: 'epic-wp-machines-list',
    templateUrl: 'epic-wp-machines-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicWpMachinesListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: EpicWpMachine[]

    @Output() rowClicked$ = new EventEmitter<EpicWpMachine>()
    @Output() edit$ = new EventEmitter<EpicWpMachine>()
    @Output() clone$ = new EventEmitter<EpicWpMachine>()
    @Output() details$ = new EventEmitter<EpicWpMachine>()

    readonly colDefs = EpicWpMachinesGrid.getColDefs()
    readonly gridOptions = EpicWpMachinesGrid.getGridOptions()

    onRowClicked(event: RowClickedEvent<EpicWpMachine>) {
        this.rowClicked$.emit(event.data)
    }

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<EpicWpMachinesGrid.CellEventEvent, any, EpicWpMachine>): void {
        switch (event.eventName) {

            case CellEventEvent.Details:
                this.details$.emit(event.rowData)
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
