import { Component, EventEmitter, Input, Output } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field'
import { MatOption, MatSelect } from '@angular/material/select'
import { EpicWpMachine } from 'epic-ui/api'
import { EpicIconComponent, EpicButtonModule } from 'epic-ui/common/components'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-wp-machine-card',
    templateUrl: 'epic-wp-machine-card.component.html',
    standalone: true,
    imports: [
        MatCardContent,
        MatCard,
        EpicIconComponent,
        EpicButtonModule,
        FormsModule,
        MatFormField,
        MatSelect,
        MatOption,
        MatLabel,
        MatPrefix,
    ],
    host: {
        class: 'd-block',
    },
})
export class EpicWpMachineCardComponent extends BaseComponent {

    @Input({ required: true }) entity!: EpicWpMachine

    @Output() loadedWaferChanged$ = new EventEmitter<number | null>()
    @Output() installedProbeCardChanged$ = new EventEmitter<number | null>()

    onProbeCardChanged(loadedProbeCardId: number | null): void {
        this.installedProbeCardChanged$.emit(loadedProbeCardId)
    }

    onLoadedWaferChanged(loadedWaferId: number | null): void {
        this.loadedWaferChanged$.emit(loadedWaferId)
    }

}
