import { DatePipe, NgClass } from '@angular/common'
import { Component, Input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { EpicWaferTestStatus } from 'epic-ui/api'
import { EpicButtonModule, EpicLabelModule } from 'epic-ui/common/components'
import { BaseComponent } from 'epic-ui/utils'

import { EpicWaferTestExtended } from '../../models'


@Component({
    selector: 'epic-wafer-test-extended-info',
    templateUrl: 'epic-wafer-test-extended-info.component.html',
    standalone: true,
    imports: [
        EpicButtonModule,
        DatePipe,
        EpicLabelModule,
        NgClass,
        RouterLink,
    ],
})
export class EpicWaferTestExtendedInfoComponent extends BaseComponent {

    @Input({ required: true }) entity!: EpicWaferTestExtended

    readonly EpicWaferTestStatus = EpicWaferTestStatus

}
