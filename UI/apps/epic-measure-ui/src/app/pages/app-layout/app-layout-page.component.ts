import { Component, inject, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { FormsModule } from '@angular/forms'
import { MatDivider } from '@angular/material/divider'
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu'
import { MatSlideToggle } from '@angular/material/slide-toggle'
import { RouterOutlet } from '@angular/router'
import { environment } from '@env/environment'
import { EpicAuthService } from 'epic-ui/common/auth'
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

    constructor() {
        super()
        this.user = toSignal(this.epicAuthService.user$)
    }

    onLogout(): void {
        this.epicAuthService.logout()
            .subscribe({
                error: (error: Error) => this.epicNotificationService.error(error.message, 'Log-out'),
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
