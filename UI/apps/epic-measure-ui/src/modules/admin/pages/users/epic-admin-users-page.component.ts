import { Component, inject, OnDestroy, OnInit, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { MatButton, MatIconButton } from '@angular/material/button'
import { MatTooltip } from '@angular/material/tooltip'
import { EpicAuthService } from 'epic-ui/common/auth'
import {
    EpicButtonModule,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
    EpicIconComponent,
    EpicLoaderComponent,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicUsersDialogsService, EpicUsersGridDataSource, EpicUsersListComponent } from 'epic-ui/shared/users'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { map } from 'rxjs'
import { EpicUser } from 'svt-ts-types'


/**
 * The users of the installation (`/admin/users`, an Admin only: `AppRoleGuard`). The grid, "New user", and per row
 * Edit, Set password, Switch off / Switch on. The row of the logged-in user cannot be switched off and its role cannot
 * be changed; the DB agent keeps one active Admin anyway.
 */
@Component({
    selector: 'epic-admin-users-page',
    templateUrl: 'epic-admin-users-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        MatButton,
        MatIconButton,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicContentErrorMessagePipe,
        EpicUsersListComponent,
    ],
})
export class EpicAdminUsersPageComponent extends BaseComponent implements OnInit, OnDestroy {

    readonly entitiesList: Signal<EpicUser[] | null>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>
    readonly currentUserId: Signal<number | null>

    // DI
    protected readonly dataSource = inject(EpicUsersGridDataSource)
    protected readonly usersDialogsService = inject(EpicUsersDialogsService)
    protected readonly epicAuthService = inject(EpicAuthService)

    constructor() {
        super()
        this.entitiesList = toSignal(this.dataSource.data$, { initialValue: null })
        this.dataFetchingProcessing = toSignal(
            this.dataSource.loadingProcessing$,
            { initialValue: ProcessingStore.getDefaultProcessingState() },
        )
        this.currentUserId = toSignal(this.epicAuthService.user$.pipe(map((user) => user?.id ?? null)), { initialValue: null })
    }

    ngOnInit(): void {
        this.dataSource.connect()
        this.dataSource.load()
    }

    override ngOnDestroy(): void {
        super.ngOnDestroy()
        this.dataSource.disconnect()
    }

    onReload(): void {
        this.dataSource.load(true)
    }

    onCreate(): void {
        this.usersDialogsService.openCreateDialog({ onSuccess: () => this.onReload() })
    }

    onEdit(user: EpicUser): void {
        this.usersDialogsService.openUpdateDialog(user, this.currentUserId(), { onSuccess: () => this.onReload() })
    }

    onSetPassword(user: EpicUser): void {
        this.usersDialogsService.openPasswordDialog(user)
    }

    onSwitchOff(user: EpicUser): void {
        this.usersDialogsService.openSwitchOffDialog(user, { onSuccess: () => this.onReload() })
    }

    onSwitchOn(user: EpicUser): void {
        this.usersDialogsService.switchOn(user, { onSuccess: () => this.onReload() })
    }

}
