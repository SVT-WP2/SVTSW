import { Component, input } from '@angular/core'
import { EpicChipBlock } from 'epic-ui/api'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-chip-block-info',
    templateUrl: 'epic-chip-block-info.component.html',
    standalone: true,
    imports: [],
})
export class EpicChipBlockInfoComponent extends BaseComponent {

    readonly chipBlock = input.required<EpicChipBlock>()

}
