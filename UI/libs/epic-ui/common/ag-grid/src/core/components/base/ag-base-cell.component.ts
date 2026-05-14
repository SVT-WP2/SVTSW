import { Component, EventEmitter, Output } from '@angular/core'
import { ICellRendererAngularComp } from 'ag-grid-angular'
import { ICellRendererParams, IRowNode } from 'ag-grid-community'
import { BaseComponent } from 'epic-ui/utils'
import { takeUntil } from 'rxjs/operators'

import { EpicAgGridCell } from '../../models'


@Component({
    selector: 'ag-base-cell',
    template: '',
    standalone: false,
})
export abstract class AgBaseCellComponent<TRowData extends Record<string, any> = Record<string, any>,
    TParams extends ICellRendererParams = ICellRendererParams>
    extends BaseComponent
    implements ICellRendererAngularComp {

    @Output() event$ = new EventEmitter<EpicAgGridCell.CellRendererEvent>()

    params: TParams | undefined
    row: TRowData | undefined
    rowNode: IRowNode<TRowData> | undefined

    get cellParamValueGetterArgs(): EpicAgGridCell.CellParamValueGetterArgs {
        return {
            rowData: this.row!,
            params: this.params as  any,
        }
    }

    agInit(params: TParams): void {
        this.initFromParams(params)

        this.event$
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe((event: EpicAgGridCell.CellRendererEvent) => {
                if (this.params?.context?.emitCellEvent) {
                    (this.params.context.emitCellEvent as ((event: EpicAgGridCell.CellRendererEvent) => void))(event)
                }
            })
    }

    refresh(params: TParams): boolean {
        this.initFromParams(params)
        return true
    }

    protected initFromParams(params: TParams): void {
        this.params = params
        this.row = params.data
        this.rowNode = params.node
    }


    protected emitCellEvent(eventName: string, data?: Record<string, any>): void {
        this.event$.emit({
            eventName,
            data,
            rowData: this.row,
            colDef: this.params?.colDef,
        })
    }

}
