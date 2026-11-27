import { Component, inject, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { FormsModule } from '@angular/forms'
import { MatDivider } from '@angular/material/divider'
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu'
import { MatSlideToggle } from '@angular/material/slide-toggle'
import { RouterOutlet } from '@angular/router'
import { environment } from '@env/environment'
import { EpicAuthPasswordChangeDialogService, EpicAuthService } from 'epic-ui/common/auth'
import { EpicIconComponent, EpicIconMatOutlinedPipe, EpicMenuLightModule, EpicNotificationService } from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { BaseComponent } from 'epic-ui/utils'
import { EpicAuthUser } from 'svt-ts-types'

import { AppMock, AppSidebarNav } from '../../models'


@Component({
    selector: 'app-layout-page',
    templateUrl: 'app-layout-page.component.html',
    imports: [
        EpicLayoutLightModule,
        EpicMenuLightModule,
        RouterOutlet,
        EpicIconComponent,
        MatMenuTrigger,
        MatMenu,
        EpicIconMatOutlinedPipe,
        MatMenuItem,
        MatDivider,
        MatSlideToggle,
        FormsModule,
    ],
})
export class AppLayoutPageComponent extends BaseComponent {

    readonly sidebarMenu = AppSidebarNav.getSidebarMenu()
    readonly user: Signal<EpicAuthUser | null>

    readonly disableMockDataControl = environment.useMockData
    readonly useMockData: boolean = this.disableMockDataControl ? true : AppMock.getMockSettings().useMockData
    readonly version = environment.version

    // DI
    private readonly epicAuthService = inject(EpicAuthService)
    private readonly epicNotificationService = inject(EpicNotificationService)
    private readonly passwordChangeDialogService = inject(EpicAuthPasswordChangeDialogService)

    constructor() {
        super()
        this.user = toSignal(this.epicAuthService.user$)
    }

    onChangePassword(): void {
        this.passwordChangeDialogService.openDialog()
    }

    onLogout(): void {
        this.epicAuthService.logout()
            .subscribe({
                // Like every toast it closes by itself after 5 s, but a toast waits while the mouse is on it. At the
                // usual place (bottom left) it would open under the mouse, over the Account button: bottom center.
                error: (error: Error) => this.epicNotificationService.error(
                    error.message,
                    'Log-out',
                    true,
                    { positionClass: 'toast-bottom-center' },
                ),
            })
    }

    onUseMockDataChanged(useMockData: boolean): void {
        AppMock.saveMockSettings({
            ...AppMock.getMockSettings(),
            useMockData: useMockData,
        })
        window.location.reload()
    }

}
