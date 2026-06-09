import { Component, Input } from '@angular/core'

import { EpicTabs } from '../../models'
import { EpicTabsBaseComponent } from '../common'


@Component({
    selector: 'epic-horizontal-tabs',
    templateUrl: './epic-horizontal-tabs.component.html',
    standalone: false,
})
export class EpicHorizontalTabsComponent extends EpicTabsBaseComponent {

    @Input() align: 'start' | 'center' | 'end' = 'start'
    @Input() tabsStyle: EpicTabs.HorizontalTabsStyle = EpicTabs.HorizontalTabsStyle.primary
    @Input() stretchTabs = false

}
