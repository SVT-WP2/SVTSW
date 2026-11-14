import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { RowClickedEvent } from 'ag-grid-community'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'
import { EpicAsic } from 'svt-ts-types'

import { EpicAsicsGrid } from '../../models'

import CellEventEvent = EpicAsicsGrid.CellEventEvent


@Component({
    selector: 'epic-asics-list',
    templateUrl: 'epic-asics-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicAsicsListComponent extends BaseComponent {

    @Input({ required: true }) entities!: EpicAsic[]
    @Input() colDefs = EpicAsicsGrid.getColDefs()
    @Input() gridOptions = EpicAsicsGrid.getGridOptions()

    @Output() rowClicked$ = new EventEmitter<EpicAsic>()
    @Output() edit$ = new EventEmitter<EpicAsic>()
    @Output() clone$ = new EventEmitter<EpicAsic>()

    onRowClicked(event: RowClickedEvent<EpicAsic>) {
        this.rowClicked$.emit(event.data)
    }

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<EpicAsicsGrid.CellEventEvent, any, EpicAsic>): void {
        switch (event.eventName) {
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
