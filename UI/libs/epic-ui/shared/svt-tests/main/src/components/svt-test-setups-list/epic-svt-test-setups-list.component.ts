import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { RowClickedEvent } from 'ag-grid-community'
import { EpicSvtTestSetup } from 'epic-ui/api'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicSvtTestSetupsGrid } from '../../models'

import CellEventEvent = EpicSvtTestSetupsGrid.CellEventEvent


@Component({
    selector: 'epic-svt-test-setups-list',
    templateUrl: 'epic-svt-test-setups-list.component.html',
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicSvtTestSetupsListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: EpicSvtTestSetup[]

    @Output() rowClicked$ = new EventEmitter<EpicSvtTestSetup>()
    @Output() details$ = new EventEmitter<EpicSvtTestSetup>()

    readonly colDefs = EpicSvtTestSetupsGrid.getColDefs()
    readonly gridOptions = EpicSvtTestSetupsGrid.getGridOptions()

    onRowClicked(event: RowClickedEvent<EpicSvtTestSetup>) {
        this.rowClicked$.emit(event.data)
    }

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<EpicSvtTestSetupsGrid.CellEventEvent, any, EpicSvtTestSetup>): void {
        switch (event.eventName) {

            case CellEventEvent.Details:
                this.details$.emit(event.rowData)
                break

            default:
                // DO NOTHING
        }
    }

}
