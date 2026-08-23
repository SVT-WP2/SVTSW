import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { EpicSvtTestType, EpicSvtTestTypeConfig } from 'epic-ui/api'
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

    @Output() details$ = new EventEmitter<EpicSvtTestType>()

    colDefs = EpicSvtTestTypesGrid.getColDefs()

    readonly gridOptions = EpicSvtTestTypesGrid.getGridOptions()

    // the details link points at one of the test type configs, so the name column is rebuilt once they arrive
    @Input({ required: true })
    set testTypeConfigs(value: EpicSvtTestTypeConfig[]) {
        this.colDefs = EpicSvtTestTypesGrid.getColDefs(value)
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
