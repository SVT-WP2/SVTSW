import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { EpicNavTabs, EpicSearchBoxModule, EpicTabsModule } from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { BaseComponent, EpicSearchPipe } from 'epic-ui/utils'


@Component({
    selector: 'epic-admin-general-page',
    templateUrl: 'epic-admin-general-page.component.html',
    imports: [
        RouterOutlet,
        EpicTabsModule,
        EpicLayoutLightModule,
        EpicSearchBoxModule,
        EpicSearchPipe,
    ],
})
export class EpicAdminGeneralPageComponent extends BaseComponent {

    readonly navTabs: EpicNavTabs.NavTabInfo[] = [
        {
            routerLink: './wafer-types',
            label: 'Wafer Types',
            routerLinkActiveOptions: { exact: false },
        },
        {
            routerLink: './wp-machines',
            label: 'WP Machines',
            routerLinkActiveOptions: { exact: false },
        },
        {
            routerLink: './wp-probe-cards',
            label: 'WP Probe Cards',
            routerLinkActiveOptions: { exact: false },
        },
        {
            routerLink: './wp-projects',
            label: 'WP Projects',
            routerLinkActiveOptions: { exact: false },
        },
        {
            routerLink: './equipment-types',
            label: 'Equipment Types',
            routerLinkActiveOptions: { exact: false },
        },
        {
            routerLink: './equipment',
            label: 'Equipment',
            routerLinkActiveOptions: { exact: false },
        },
    ]
        .sort((left, right) => left.label.localeCompare(right.label))

    searchTerm = ''

}
