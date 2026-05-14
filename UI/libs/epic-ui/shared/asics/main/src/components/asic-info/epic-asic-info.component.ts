import { Component, Input } from '@angular/core'
import { EpicAsic } from 'epic-ui/api'
import { EpicButtonModule } from 'epic-ui/common/components'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-asic-info',
    templateUrl: 'epic-asic-info.component.html',
    standalone: true,
    imports: [
        EpicButtonModule,
    ],
})
export class EpicAsicInfoComponent extends BaseComponent {

    @Input({ required: true }) asic!: EpicAsic

}
