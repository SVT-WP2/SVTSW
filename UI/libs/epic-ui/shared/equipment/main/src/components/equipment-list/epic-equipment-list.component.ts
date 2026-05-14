import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicEquipmentGrid } from '../../models'

import Grid =  EpicEquipmentGrid 


@Component({
    selector: 'epic-equipment-list',
    templateUrl: 'epic-equipment-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicEquipmentListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: Grid.RowEntity[]

    @Output() locationHistory$ = new EventEmitter<Grid.RowEntity>()
    @Output() updateLocation$ = new EventEmitter<Grid.RowEntity>()

    readonly colDefs = Grid.getColDefs()
    readonly gridOptions = Grid.getGridOptions()

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<Grid.CellEventEvent, any,  Grid.RowEntity>): void {
        switch (event.eventName) {
            case Grid.CellEventEvent.LocationHistory:
                this.locationHistory$.emit(event.rowData)
                break
            case Grid.CellEventEvent.UpdateLocation:
                this.updateLocation$.emit(event.rowData)
                break
            default:
            // DO NOTHING
        }
    }

}
