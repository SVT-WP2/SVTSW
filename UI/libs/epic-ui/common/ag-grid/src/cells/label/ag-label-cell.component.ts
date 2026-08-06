import { ChangeDetectionStrategy, Component, Inject, signal, WritableSignal } from '@angular/core'
import { MatTooltipModule } from '@angular/material/tooltip'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicLabelModule } from 'epic-ui/common/components'
import { ISystemColors, SYSTEM_COLORS } from 'epic-ui/utils/colors'
import { isObservable, of, Subscription, takeUntil } from 'rxjs'
import { catchError } from 'rxjs/operators'

import { AgBaseCellComponent, EpicAgGridCell } from '../../core'

import { AgLabelCell } from './ag-label-cell.models'


@Component({
    selector: 'ag-label-cell',
    templateUrl: './ag-label-cell.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        EpicLabelModule,
        MatTooltipModule,
        TranslatePipe,
    ],
})
export class AgLabelCellComponent extends AgBaseCellComponent<Record<string, unknown>, AgLabelCell.CellParams> {

    readonly state: WritableSignal<AgLabelCell.State>

    protected readonly defaultConfig: AgLabelCell.Config

    protected configSub: Subscription

    constructor(@Inject(SYSTEM_COLORS) protected readonly systemColors: ISystemColors) {
        super()

        this.defaultConfig = AgLabelCell.getDefaultConfig(this.systemColors)
        this.state = signal<AgLabelCell.State>(AgLabelCell.toState(undefined, this.defaultConfig))

    }

    override agInit(params: AgLabelCell.CellParams): void {
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
                        AgLabelCell.toState(
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
