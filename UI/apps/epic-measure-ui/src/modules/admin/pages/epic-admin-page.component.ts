import { Component, inject, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { RouterOutlet } from '@angular/router'
import { EpicAuthService } from 'epic-ui/common/auth'
import { EpicNavTabs, EpicTabsModule } from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { BaseComponent } from 'epic-ui/utils'
import { map } from 'rxjs'
import { EpicUserRole, isEpicUserRoleAtLeast } from 'svt-ts-types'


/**
 * The tabs of the Administration area for a user of `role`. "Users" is shown to an Admin only; the other tabs to every
 * logged-in user (D13).
 */
export function getEpicAdminNavTabs(role: EpicUserRole | null | undefined): EpicNavTabs.NavTabInfo[] {
    const tabs: EpicNavTabs.NavTabInfo[] = [
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
    if (role && isEpicUserRoleAtLeast(role, EpicUserRole.Admin)) {
        tabs.push({
            routerLink: './users',
            label: 'Users',
            routerLinkActiveOptions: { exact: false },
        })
    }
    return tabs
}

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

    readonly navTabs: Signal<EpicNavTabs.NavTabInfo[]>

    // DI
    private readonly epicAuthService = inject(EpicAuthService)

    constructor() {
        super()
        this.navTabs = toSignal(
            this.epicAuthService.user$.pipe(map((user) => getEpicAdminNavTabs(user?.role))),
            { initialValue: getEpicAdminNavTabs(this.epicAuthService.user?.role) },
        )
    }

}
