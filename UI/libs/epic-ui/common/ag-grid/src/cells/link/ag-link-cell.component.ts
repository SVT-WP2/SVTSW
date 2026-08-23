import { ChangeDetectionStrategy, Component, signal, WritableSignal } from '@angular/core'
import { MatTooltipModule } from '@angular/material/tooltip'
import { RouterLink } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { isObservable, of, Subscription, takeUntil } from 'rxjs'
import { catchError } from 'rxjs/operators'

import { AgBaseCellComponent, EpicAgGridCell } from '../../core'

import { AgLinkCell } from './ag-link-cell.models'


@Component({
    selector: 'ag-link-cell',
    templateUrl: './ag-link-cell.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatTooltipModule,
        RouterLink,
        TranslatePipe,
    ],
})
export class AgLinkCellComponent extends AgBaseCellComponent<Record<string, unknown>, AgLinkCell.CellParams> {

    readonly state: WritableSignal<AgLinkCell.State>

    protected readonly defaultConfig: AgLinkCell.Config

    protected configSub?: Subscription

    constructor() {
        super()

        this.defaultConfig = AgLinkCell.getDefaultConfig()
        this.state = signal<AgLinkCell.State>(AgLinkCell.toState(undefined, this.defaultConfig))
    }

    override agInit(params: AgLinkCell.CellParams): void {
        super.agInit(params)

        const rawConfig = EpicAgGridCell.getCellParamValue(params.config, this.cellParamValueGetterArgs)
        const config$ = isObservable(rawConfig) ? rawConfig : of(rawConfig)

        this.configSub?.unsubscribe()
        this.configSub = config$
            .pipe(
                catchError(() => of(null)),
                takeUntil(this.destroyed$),
            )
            .subscribe((config) => {
                this.state
                    .set(
                        AgLinkCell.toState(
                            (params.colDef?.valueFormatter ? params.valueFormatted : params.value) as string,
                            {
                                ...this.defaultConfig,
                                ...(config || {}),
                            },
                        ),
                    )
            })
    }

    override refresh(): boolean {
        return false
    }

}
