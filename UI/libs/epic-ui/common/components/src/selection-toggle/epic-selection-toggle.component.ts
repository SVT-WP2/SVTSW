import { Component, EventEmitter, Input, Output } from '@angular/core'
import { MatTooltip } from '@angular/material/tooltip'
import { TranslatePipe } from '@ngx-translate/core'

import { EpicButtonModule } from '../button'
import { EpicIconComponent } from '../icon'


@Component({
    selector: 'epic-selection-toggle',
    templateUrl: './epic-selection-toggle.component.html',
    imports: [
        MatTooltip,
        TranslatePipe,
        EpicButtonModule,
        EpicIconComponent,
    ],
    host: {
        class: 'd-inline-block',
    },
})
export class EpicSelectionToggleComponent {

    @Input() showSelectAll = true
    @Input() disabled = false

    @Output() clear$ = new EventEmitter<void>()
    @Output() selectAll$ = new EventEmitter<void>()

    onSelectAll(): void {
        this.selectAll$.emit()
    }

    onClear(): void {
        this.clear$.emit()
    }

}
