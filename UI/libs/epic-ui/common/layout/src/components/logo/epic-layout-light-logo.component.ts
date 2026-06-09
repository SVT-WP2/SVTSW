import { Component, Input } from '@angular/core'

import { EpicLayoutLight } from '../../models'


@Component({
    selector: 'epic-layout-light-logo',
    templateUrl: './epic-layout-light-logo.component.html',
    standalone: false,
})
export class EpicLayoutLightLogoComponent {

    @Input() logoPath = EpicLayoutLight.LOGO_PATH

}
