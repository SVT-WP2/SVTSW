import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { AgGridCellEventDirective, AgIconActionsCellModule, EpicAgGridCell } from 'epic-ui/common/ag-grid'
import { BaseComponent } from 'epic-ui/utils'

import { EpicUsersGrid, EpicUsersRules } from '../../models'

import Grid = EpicUsersGrid


/** The grid of the users, with the actions of each row. The row of the logged-in user cannot be switched off. */
@Component({
    selector: 'epic-users-list',
    templateUrl: 'epic-users-list.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        AgIconActionsCellModule,
        AgGridCellEventDirective,
    ],
})
export class EpicUsersListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: Grid.RowEntity[]
    /** The id of the logged-in user. */
    @Input() currentUserId: number | null = null

    @Output() edit$ = new EventEmitter<Grid.RowEntity>()
    @Output() setPassword$ = new EventEmitter<Grid.RowEntity>()
    @Output() switchOff$ = new EventEmitter<Grid.RowEntity>()
    @Output() switchOn$ = new EventEmitter<Grid.RowEntity>()

    readonly colDefs = Grid.getColDefs({ isOwnUser: (row) => EpicUsersRules.isOwnUser(row, this.currentUserId) })
    readonly gridOptions = Grid.getGridOptions()

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<Grid.CellEventEvent, any, Grid.RowEntity>): void {
        switch (event.eventName) {
            case Grid.CellEventEvent.Edit:
                this.edit$.emit(event.rowData)
                break
            case Grid.CellEventEvent.SetPassword:
                this.setPassword$.emit(event.rowData)
                break
            case Grid.CellEventEvent.SwitchOff:
                // The button of the own row is disabled; this is a second line.
                if (!EpicUsersRules.isOwnUser(event.rowData, this.currentUserId)) {
                    this.switchOff$.emit(event.rowData)
                }
                break
            case Grid.CellEventEvent.SwitchOn:
                this.switchOn$.emit(event.rowData)
                break
            default:
            // DO NOTHING
        }
    }

}
