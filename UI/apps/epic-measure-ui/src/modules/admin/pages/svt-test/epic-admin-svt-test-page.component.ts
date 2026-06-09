import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { EpicNavTabs, EpicSearchBoxModule, EpicTabsModule } from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { BaseComponent, EpicSearchPipe } from 'epic-ui/utils'


@Component({
    selector: 'epic-admin-svt-test-page',
    templateUrl: 'epic-admin-svt-test-page.component.html',
    imports: [
        RouterOutlet,
        EpicTabsModule,
        EpicLayoutLightModule,
        EpicSearchBoxModule,
        EpicSearchPipe,
    ],
})
export class EpicAdminSvtTestPageComponent extends BaseComponent {

    readonly navTabs: EpicNavTabs.NavTabInfo[] = [
        {
            routerLink: './test-setups',
            label: 'Test Setups',
            routerLinkActiveOptions: { exact: false },
        },
        {
            routerLink: './test-types',
            label: 'Test Types',
            routerLinkActiveOptions: { exact: false },
        },
        {
            routerLink: './test-templates',
            label: 'Test Templates',
            routerLinkActiveOptions: { exact: false },
        },
    ]
        .sort((left, right) => left.label.localeCompare(right.label))

    searchTerm = ''

}
