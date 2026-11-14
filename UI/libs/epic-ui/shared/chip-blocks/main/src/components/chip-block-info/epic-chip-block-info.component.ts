import { Component, input } from '@angular/core'
import { BaseComponent } from 'epic-ui/utils'
import { EpicChipBlock } from 'svt-ts-types'


@Component({
    selector: 'epic-chip-block-info',
    templateUrl: 'epic-chip-block-info.component.html',
    standalone: true,
    imports: [],
})
export class EpicChipBlockInfoComponent extends BaseComponent {

    readonly chipBlock = input.required<EpicChipBlock>()

}
