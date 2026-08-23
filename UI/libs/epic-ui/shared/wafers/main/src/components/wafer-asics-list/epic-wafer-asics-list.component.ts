import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { GridApi, GridReadyEvent } from 'ag-grid-community'
import { EpicAsic } from 'epic-ui/api'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicWaferAsicsGrid } from '../../models'

import CellEventEvent = EpicWaferAsicsGrid.CellEventEvent


@Component({
    selector: 'epic-wafer-asics-list',
    templateUrl: 'epic-wafer-asics-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicWaferAsicsListComponent extends BaseComponent {

    @Input({ required: true }) entities!: EpicAsic[]

    @Input() colDefs = EpicWaferAsicsGrid.getColDefs()
    @Input() gridOptions = EpicWaferAsicsGrid.getGridOptions()

    @Output() clone$ = new EventEmitter<EpicAsic>()
    @Output() gridReady$ = new EventEmitter<GridApi<EpicWaferAsicsGrid.RowEntity>>()

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<EpicWaferAsicsGrid.CellEventEvent, any, EpicAsic>): void {
        switch (event.eventName) {

            case CellEventEvent.Clone:
                this.clone$.emit(event.rowData)
                break

            default:
                // DO NOTHING
        }
    }

    onGridReady({ api }: GridReadyEvent<EpicWaferAsicsGrid.RowEntity>): void {
        this.gridReady$.emit(api)
    }

}
