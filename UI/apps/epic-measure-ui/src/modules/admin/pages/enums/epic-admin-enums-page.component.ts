import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { EpicEnumName } from 'epic-ui/api'
import { EpicNavTabs, EpicSearchBoxModule, EpicTabsModule } from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { BaseComponent, EpicSearchPipe } from 'epic-ui/utils'


@Component({
    selector: 'epic-admin-enums-page',
    templateUrl: 'epic-admin-enums-page.component.html',
    imports: [
        RouterOutlet,
        EpicTabsModule,
        EpicLayoutLightModule,
        EpicSearchBoxModule,
        EpicSearchPipe,
    ],
})
export class EpicAdminEnumsPageComponent extends BaseComponent {

    readonly navTabs: EpicNavTabs.NavTabInfo[] = Object.values(EpicEnumName).map(item => (        {
        routerLink: `./by-name/${item}`,
        label: item,
        routerLinkActiveOptions: { exact: false },
    }))
        .sort((left, right) => left.label.localeCompare(right.label))

    searchTerm = ''

}
