import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { EpicNavTabs, EpicTabsModule } from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { BaseComponent, EpicSearchPipe } from 'epic-ui/utils'


@Component({
    selector: 'epic-dev-wafers-page',
    templateUrl: 'epic-dev-asics-page.component.html',
    imports: [
        EpicLayoutLightModule,
        EpicTabsModule,
        EpicSearchPipe,
        RouterOutlet,
    ],
})
export class EpicDevAsicsPageComponent extends BaseComponent {

    readonly navTabs: EpicNavTabs.NavTabInfo[] = [
        {
            routerLink: './create-chip',
            label: 'Chip :: Create',
            routerLinkActiveOptions: { exact: false },
        },
    ]
        .sort((left, right) => left.label.localeCompare(right.label))

    searchTerm: string

}
