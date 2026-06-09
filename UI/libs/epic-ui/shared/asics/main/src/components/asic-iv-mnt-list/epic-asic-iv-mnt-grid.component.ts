import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { RowClickedEvent } from 'ag-grid-community'
import { EpicIvMnt } from 'epic-ui/api'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicAsicIvMntListGrid } from '../../models'

import CellEventEvent = EpicAsicIvMntListGrid.CellEventEvent


@Component({
    selector: 'epic-asic-iv-mnt-grid',
    templateUrl: 'epic-asic-iv-mnt-grid.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicAsicIvMntGridComponent extends BaseComponent {

    @Input({ required: true }) entities!: EpicIvMnt[]

    @Input() colDefs = EpicAsicIvMntListGrid.getColDefs()
    @Input() gridOptions = EpicAsicIvMntListGrid.getGridOptions()

    @Output() rowClicked$ = new EventEmitter<EpicIvMnt>()
    @Output() details$ = new EventEmitter<EpicIvMnt>()
    @Output() repeat$ = new EventEmitter<EpicIvMnt>()
    @Output() delete$ = new EventEmitter<EpicIvMnt>()

    onRowClicked(event: RowClickedEvent<EpicIvMnt>) {
        this.rowClicked$.emit(event.data)
    }

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<EpicAsicIvMntListGrid.CellEventEvent, any, EpicIvMnt>): void {
        switch (event.eventName) {
            case CellEventEvent.Delete:
                this.delete$.emit(event.rowData)
                break

            case CellEventEvent.Repeat:
                this.repeat$.emit(event.rowData)
                break

            case CellEventEvent.Details:
                this.details$.emit(event.rowData)
                break

            default:
            // DO NOTHING
        }
    }

}
