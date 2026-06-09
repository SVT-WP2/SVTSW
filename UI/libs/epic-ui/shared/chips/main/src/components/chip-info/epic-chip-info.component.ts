import { Component, input } from '@angular/core'
import { EpicChip } from 'epic-ui/api'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-chip-info',
    templateUrl: 'epic-chip-info.component.html',
    standalone: true,
    imports: [],
})
export class EpicChipInfoComponent extends BaseComponent {

    readonly chip = input.required<EpicChip>()

}
