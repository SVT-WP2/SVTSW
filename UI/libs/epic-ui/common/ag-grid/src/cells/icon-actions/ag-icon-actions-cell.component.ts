import { ChangeDetectorRef, Component } from '@angular/core'
import { GenericEventInfo } from 'epic-ui/utils'
import { isObservable, Observable, of, Subscription } from 'rxjs'
import { takeUntil } from 'rxjs/operators'

import { AgBaseCellComponent, EpicAgGridCell } from '../../core'

import { AgIconActionsCell } from './ag-icon-actions-cell.models'


@Component({
    selector: 'ag-icon-actions',
    templateUrl: './ag-icon-actions-cell.component.html',
    standalone: false,
})
export class AgIconActionsCellComponent extends AgBaseCellComponent {

    iconActions: AgIconActionsCell.Action[] = []

    protected iconActionsSub?: Subscription

    constructor(
        protected readonly changeDetectorRef: ChangeDetectorRef,
    ) {
        super()
    }

    override agInit(params: AgIconActionsCell.CellParams): void {
        super.agInit(params)

        const iconActions = EpicAgGridCell.getCellParamValue(params.actions, this.cellParamValueGetterArgs)
        const iconActions$: Observable<AgIconActionsCell.Action[]> =
            isObservable(iconActions)
                ? iconActions
                : of(iconActions!)

        this.iconActionsSub?.unsubscribe()
        this.iconActionsSub = iconActions$
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe((actions: AgIconActionsCell.Action[]) => {
                this.iconActions = actions
                this.changeDetectorRef.detectChanges()
            })
    }

    onIconActionClicked(onClick?: () => GenericEventInfo): void {
        if (onClick) {
            const event = onClick()
            this.emitCellEvent(event.eventName, event.data)
        }
    }

    onActionEvent(event: GenericEventInfo): void {
        this.emitCellEvent(event.eventName, event.data)
    }

    override refresh(): boolean {
        return false
    }

}
