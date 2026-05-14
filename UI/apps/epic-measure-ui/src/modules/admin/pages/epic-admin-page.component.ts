import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { EpicNavTabs, EpicTabsModule } from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-admin-page',
    templateUrl: 'epic-admin-page.component.html',
    imports: [
        RouterOutlet,
        EpicTabsModule,
        EpicLayoutLightModule,
    ],
})
export class EpicAdminPageComponent extends BaseComponent {

    readonly navTabs: EpicNavTabs.NavTabInfo[] = [
        {
            routerLink: './general',
            label: 'General',
            routerLinkActiveOptions: { exact: false },
        },
        {
            routerLink: './svt-test',
            label: 'SVT Test',
            routerLinkActiveOptions: { exact: false },
        },
        {
            routerLink: './enums',
            label: 'Enums',
            routerLinkActiveOptions: { exact: false },
        },
        {
            routerLink: './tools',
            label: 'Tools',
            routerLinkActiveOptions: { exact: false },
        },
    ]

}
