import { Component, inject, Signal } from '@angular/core'
import { MatTooltip } from '@angular/material/tooltip'
import { Router } from '@angular/router'
import { Store } from '@ngrx/store'
import { EpicWpMachine } from 'epic-ui/api'
import {
    EpicIconComponent,
    EpicButtonModule,
    EpicContentErrorModule,
    EpicLoaderComponent,
    EpicContentErrorMessagePipe,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicWpMachineUpdateDialogService,
    EpicWpMachinesActions,
    EpicWpMachinesListComponent,
    EpicWpMachinesSelectors,
} from 'epic-ui/shared/wp'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import StoreActions = EpicWpMachinesActions
import StoreSelectors = EpicWpMachinesSelectors


@Component({
    selector: 'epic-admin-wp-machines-list-page',
    templateUrl: 'epic-admin-wp-machines-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicWpMachinesListComponent,
        EpicContentErrorMessagePipe,
    ],
})
export class EpicAdminWpMachinesListPageComponent extends BaseComponent {

    readonly entitiesList: Signal<EpicWpMachine[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly router = inject(Router)
    protected readonly store = inject(Store)
    protected readonly epicWpMachineCreateDialog = inject(EpicWpMachineUpdateDialogService)

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

    onRowDetails(rowData: EpicWpMachine): void {
        this.openDetailsDialog(rowData)
    }

    onRowClone(rowData: EpicWpMachine): void {
        this.epicWpMachineCreateDialog.openDialog(rowData.id, { isClone: true })
    }

    onRowEdit(rowData: EpicWpMachine): void {
        this.epicWpMachineCreateDialog.openDialog(rowData.id)
    }

    onCreate(): void {
        this.epicWpMachineCreateDialog.openDialog()
    }

    private openDetailsDialog(entity: EpicWpMachine): void {
        this.epicWpMachineCreateDialog.openDialog(entity.id)
    }

}
