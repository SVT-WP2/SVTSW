import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { GridApi, GridReadyEvent, IDatasource } from 'ag-grid-community'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicSvtTestsGrid } from '../../models'

import Grid = EpicSvtTestsGrid


@Component({
    selector: 'epic-svt-tests-list',
    templateUrl: 'epic-svt-tests-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicSvtTestsListComponent extends BaseComponent {

    /** Rows are pulled block by block by the grid itself — see `EpicSvtTestsGridDataSource`. */
    @Input({ required: true }) datasource: IDatasource | undefined

    @Output() rowClicked$ = new EventEmitter<Grid.RowEntity>()
    @Output() details$ = new EventEmitter<Grid.RowEntity>()

    readonly colDefs = Grid.getColDefs()
    readonly gridOptions = Grid.getGridOptions()

    protected gridApi: GridApi<Grid.RowEntity> | undefined

    onGridReady(event: GridReadyEvent<Grid.RowEntity>): void {
        this.gridApi = event.api
    }

    /**
     * The grid only shows its "no rows" overlay on its own for the client side row model, so with the infinite
     * one it has to be driven by hand. Until the first block arrives the grid still holds its placeholder row,
     * so the overlay never flashes over data that is merely still loading.
     */
    onModelUpdated(): void {
        if (!this.gridApi) {
            return
        }

        if (this.gridApi.getDisplayedRowCount() === 0) {
            this.gridApi.showNoRowsOverlay()
        }
        else {
            this.gridApi.hideOverlay()
        }
    }

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<Grid.CellEventEvent, any, Grid.RowEntity>): void {
        switch (event.eventName) {
            case Grid.CellEventEvent.Details:
                this.details$.emit(event.rowData)
                break
            default:
            // DO NOTHING
        }
    }

    onRowClicked(rowData: Grid.RowEntity): void {
        this.rowClicked$.emit(rowData)
    }

}
