import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { RowClickedEvent } from 'ag-grid-community'
import { EpicWpProbeCard } from 'epic-ui/api'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicWpProbeCardsGrid } from '../../models'

import CellEventEvent = EpicWpProbeCardsGrid.CellEventEvent


@Component({
    selector: 'epic-wp-probe-cards-list',
    templateUrl: 'epic-wp-probe-cards-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicWpProbeCardsListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: EpicWpProbeCard[]

    @Output() rowClicked$ = new EventEmitter<EpicWpProbeCard>()
    @Output() edit$ = new EventEmitter<EpicWpProbeCard>()
    @Output() clone$ = new EventEmitter<EpicWpProbeCard>()
    @Output() details$ = new EventEmitter<EpicWpProbeCard>()

    readonly colDefs = EpicWpProbeCardsGrid.getColDefs()
    readonly gridOptions = EpicWpProbeCardsGrid.getGridOptions()

    onRowClicked(event: RowClickedEvent<EpicWpProbeCard>) {
        this.rowClicked$.emit(event.data)
    }

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<EpicWpProbeCardsGrid.CellEventEvent, any, EpicWpProbeCard>): void {
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
