import { Component, Input } from '@angular/core'
import { MatDivider } from '@angular/material/divider'
import { EpicIvMnt } from 'epic-ui/api'
import { EpicButtonModule } from 'epic-ui/common/components'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-asic-iv-mnt-info',
    templateUrl: 'epic-asic-iv-mnt-info.component.html',
    standalone: true,
    imports: [
        EpicButtonModule,
        MatDivider,
    ],
})
export class EpicAsicIvMntInfoComponent extends BaseComponent {

    @Input({ required: true }) asicIvMnt!: EpicIvMnt

}
