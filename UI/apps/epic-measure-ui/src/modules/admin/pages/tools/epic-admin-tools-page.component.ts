import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { EpicNavTabs, EpicSearchBoxModule, EpicTabsModule } from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { BaseComponent, EpicSearchPipe } from 'epic-ui/utils'


@Component({
    selector: 'epic-admin-tools-page',
    templateUrl: 'epic-admin-tools-page.component.html',
    imports: [
        RouterOutlet,
        EpicTabsModule,
        EpicLayoutLightModule,
        EpicSearchBoxModule,
        EpicSearchPipe,
    ],
})
export class EpicAdminToolsPageComponent extends BaseComponent {

    readonly navTabs: EpicNavTabs.NavTabInfo[] = [
        {
            routerLink: './tcp',
            label: 'TCP/IP Connection',
            routerLinkActiveOptions: { exact: false },
        },
    ]
        .sort((left, right) => left.label.localeCompare(right.label))

    searchTerm: string

}
