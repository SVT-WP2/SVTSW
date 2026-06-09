import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { RowClickedEvent } from 'ag-grid-community'
import { EpicSvtTestType } from 'epic-ui/api'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicSvtTestTypesGrid } from '../../models'

import CellEventEvent = EpicSvtTestTypesGrid.CellEventEvent


@Component({
    selector: 'epic-svt-test-types-list',
    templateUrl: 'epic-svt-test-types-list.component.html',
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicSvtTestTypesListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: EpicSvtTestType[]

    @Output() rowClicked$ = new EventEmitter<EpicSvtTestType>()
    @Output() details$ = new EventEmitter<EpicSvtTestType>()

    readonly colDefs = EpicSvtTestTypesGrid.getColDefs()
    readonly gridOptions = EpicSvtTestTypesGrid.getGridOptions()

    onRowClicked(event: RowClickedEvent<EpicSvtTestType>) {
        this.rowClicked$.emit(event.data)
    }

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<EpicSvtTestTypesGrid.CellEventEvent, any, EpicSvtTestType>): void {
        switch (event.eventName) {

            case CellEventEvent.Details:
                this.details$.emit(event.rowData)
                break

            default:
                // DO NOTHING
        }
    }

}
