import { Component, Input } from '@angular/core'
import { EpicWafer } from 'epic-ui/api'
import { EpicButtonModule } from 'epic-ui/common/components'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-wafer-info',
    templateUrl: 'epic-wafer-info.component.html',
    imports: [
        EpicButtonModule,
    ],
})
export class EpicWaferInfoComponent extends BaseComponent {

    @Input({ required: true }) wafer!: EpicWafer

}
