import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicSvtTestTemplateGrid } from '../../models'

import Grid = EpicSvtTestTemplateGrid


@Component({
    selector: 'epic-svt-test-template-list',
    templateUrl: 'epic-svt-test-template-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicSvtTestTemplateListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: Grid.RowEntity[]

    @Output() rowClicked$ = new EventEmitter<Grid.RowEntity>()
    @Output() edit$ = new EventEmitter<Grid.RowEntity>()

    readonly colDefs = Grid.getColDefs()
    readonly gridOptions = Grid.getGridOptions()

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<Grid.CellEventEvent, any, Grid.RowEntity>): void {
        switch (event.eventName) {
            case Grid.CellEventEvent.Edit:
                this.edit$.emit(event.rowData)
                break
            default:
            // DO NOTHING
        }
    }

    onRowClicked(rowData: Grid.RowEntity): void {
        this.rowClicked$.emit(rowData)
    }

}

