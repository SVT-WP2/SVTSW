import { Component, Input } from '@angular/core'

import { EpicNoResult } from './epic-no-result.models'


@Component({
    selector: 'epic-no-result',
    templateUrl: './epic-no-result.component.html',
    standalone: false,
})
export class EpicNoResultComponent {

    @Input() message = 'COMMON.NO_RESULTS_MESSAGE'
    @Input() displayIcon = true
    @Input() size: EpicNoResult.Size = EpicNoResult.Size.basic

    readonly Size = EpicNoResult.Size

}
