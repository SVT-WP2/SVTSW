import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { RowClickedEvent } from 'ag-grid-community'
import { EpicWpProject } from 'epic-ui/api'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicWpProjectsAdminGrid } from '../../models'

import CellEventEvent = EpicWpProjectsAdminGrid.CellEventEvent


@Component({
    selector: 'epic-wp-projects-list',
    templateUrl: 'epic-wp-projects-list.component.html',
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicWpProjectsListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: EpicWpProject[]

    @Output() rowClicked$ = new EventEmitter<EpicWpProject>()
    @Output() clone$ = new EventEmitter<EpicWpProject>()
    @Output() details$ = new EventEmitter<EpicWpProject>()

    readonly colDefs = EpicWpProjectsAdminGrid.getColDefs()
    readonly gridOptions = EpicWpProjectsAdminGrid.getGridOptions()

    onRowClicked(event: RowClickedEvent<EpicWpProject>) {
        this.rowClicked$.emit(event.data)
    }

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<EpicWpProjectsAdminGrid.CellEventEvent, any, EpicWpProject>): void {
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
