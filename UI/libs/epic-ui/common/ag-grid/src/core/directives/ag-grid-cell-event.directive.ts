import { Directive, EventEmitter, forwardRef, inject, OnInit, Output } from '@angular/core'
import { AgGridAngular } from 'ag-grid-angular'

import { EpicAgGridCell } from '../models'


@Directive({
    selector: 'ag-grid-angular[epicAgGridCellEvent]',
    standalone: true,
})
export class AgGridCellEventDirective implements OnInit {

    @Output() cellEvent$ = new EventEmitter<EpicAgGridCell.CellRendererEvent>()

    readonly agGridComponent = inject<AgGridAngular>(forwardRef(() => AgGridAngular))

    ngOnInit(): void {
        if (this.agGridComponent.gridOptions) {
            this.agGridComponent.gridOptions.context = {
                ...(this.agGridComponent.gridOptions.context || {}),
                emitCellEvent: (event: EpicAgGridCell.CellRendererEvent) => {
                    this.cellEvent$.emit(event)
                },
            }
        }
    }

}
