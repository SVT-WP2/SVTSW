import { Component, Input } from '@angular/core'
import { EpicNavTabs } from 'epic-ui/common/components'


@Component({
    selector: 'epic-layout-light-header-navigation',
    templateUrl: './epic-layout-light-header-navigation.component.html',
    standalone: false,
})
export class EpicLayoutLightHeaderNavigationComponent {

    @Input() navTabs: EpicNavTabs.NavTabInfo[] = []

    readonly sectionAlias = 'HEADER_NAVIGATION'

}
