import { Component, inject, Signal } from '@angular/core'
import { MatTooltip } from '@angular/material/tooltip'
import { Router } from '@angular/router'
import { Store } from '@ngrx/store'
import { EpicWpProject } from 'epic-ui/api'
import {
    EpicIconComponent,
    EpicButtonModule,
    EpicContentErrorModule,
    EpicLoaderComponent,
    EpicContentErrorMessagePipe,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicWpProjectAdminUpdateDialogService,
    EpicWpProjectsActions,
    EpicWpProjectsListComponent,
    EpicWpProjectsSelectors,
} from 'epic-ui/shared/wp'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import StoreActions = EpicWpProjectsActions
import StoreSelectors = EpicWpProjectsSelectors


@Component({
    selector: 'epic-admin-wp-projects-list-page',
    templateUrl: 'epic-admin-wp-projects-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicWpProjectsListComponent,
        EpicContentErrorMessagePipe,
    ],
})
export class EpicAdminWpProjectsListPageComponent extends BaseComponent {

    readonly entitiesList: Signal<EpicWpProject[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly router = inject(Router)
    protected readonly store = inject(Store)
    protected readonly epicWpProjectAdminUpdateDialogService = inject(EpicWpProjectAdminUpdateDialogService)

    constructor() {
        super()
        this.dataFetchingProcessing = this.store.selectSignal(StoreSelectors.selectFetchAllProcessing)
        this.entitiesList = this.store.selectSignal(StoreSelectors.selectAllEntitiesList)

        this.store.dispatch(
            StoreActions.fetchAllRequestAction({}),
        )
    }

    onReload(): void {
        this.store.dispatch(
            StoreActions.fetchAllRequestAction({ force: true }),
        )
    }

    onRowDetails(rowData: EpicWpProject): void {
        this.openDetailsDialog(rowData)
    }

    onRowClone(rowData: EpicWpProject): void {
        this.epicWpProjectAdminUpdateDialogService.openDialog(rowData.id, { isClone: true })
    }

    onCreate(): void {
        this.epicWpProjectAdminUpdateDialogService.openDialog()
    }

    private openDetailsDialog(entity: EpicWpProject): void {
        this.epicWpProjectAdminUpdateDialogService.openDialog(entity.id)
    }

}
