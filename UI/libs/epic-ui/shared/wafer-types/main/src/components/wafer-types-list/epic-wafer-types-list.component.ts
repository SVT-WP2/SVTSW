import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { RowClickedEvent } from 'ag-grid-community'
import { EpicWaferType } from 'epic-ui/api'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicWaferTypesGrid } from '../../models'

import CellEventEvent = EpicWaferTypesGrid.CellEventEvent


@Component({
    selector: 'epic-wafer-types-list',
    templateUrl: 'epic-wafer-types-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicWaferTypesListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: EpicWaferType[]

    @Output() rowClicked$ = new EventEmitter<EpicWaferType>()
    @Output() clone$ = new EventEmitter<EpicWaferType>()
    @Output() details$ = new EventEmitter<EpicWaferType>()

    readonly colDefs = EpicWaferTypesGrid.getColDefs()
    readonly gridOptions = EpicWaferTypesGrid.getGridOptions()

    onRowClicked(event: RowClickedEvent<EpicWaferType>) {
        this.rowClicked$.emit(event.data)
    }

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<EpicWaferTypesGrid.CellEventEvent, any, EpicWaferType>): void {
        switch (event.eventName) {
            case CellEventEvent.Details:
                this.details$.emit(event.rowData)
                break

            case CellEventEvent.Clone:
                this.clone$.emit(event.rowData)
                break

            default:
                // DO NOTHING
        }
    }

}
