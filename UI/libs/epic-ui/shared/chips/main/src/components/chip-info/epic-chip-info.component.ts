import { Component, input } from '@angular/core'
import { BaseComponent } from 'epic-ui/utils'
import { EpicChip } from 'svt-ts-types'


@Component({
    selector: 'epic-chip-info',
    templateUrl: 'epic-chip-info.component.html',
    standalone: true,
    imports: [],
})
export class EpicChipInfoComponent extends BaseComponent {

    readonly chip = input.required<EpicChip>()

}
