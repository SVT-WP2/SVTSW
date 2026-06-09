import { Component, Input } from '@angular/core'

import { EpicTabs } from '../../models'
import { EpicNavTabsBaseComponent } from '../common'


@Component({
    selector: 'epic-horizontal-nav-tabs',
    templateUrl: './epic-horizontal-nav-tabs.component.html',
    standalone: false,
})
export class EpicHorizontalNavTabsComponent extends EpicNavTabsBaseComponent {

    @Input() align: 'start' | 'center' | 'end' = 'start'
    @Input() tabsStyle: EpicTabs.HorizontalTabsStyle = EpicTabs.HorizontalTabsStyle.primary
    @Input() stretchTabs = false

}
