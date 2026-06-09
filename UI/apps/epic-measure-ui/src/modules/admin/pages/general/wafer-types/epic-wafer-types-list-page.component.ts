import { Component, inject, Signal } from '@angular/core'
import { MatTooltip } from '@angular/material/tooltip'
import { Router } from '@angular/router'
import { Store } from '@ngrx/store'
import { EpicWaferType } from 'epic-ui/api'
import {
    EpicIconComponent,
    EpicButtonModule,
    EpicContentErrorModule,
    EpicLoaderComponent,
    EpicContentErrorMessagePipe,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicWaferTypeCreateDialogService,
    EpicWaferTypeDetailsDialogService,
    EpicWaferTypesActions,
    EpicWaferTypesListComponent,
    EpicWaferTypesSelectors,
} from 'epic-ui/shared/wafer-types'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import StoreActions = EpicWaferTypesActions
import StoreSelectors = EpicWaferTypesSelectors


@Component({
    selector: 'epic-wafer-types-list-page',
    templateUrl: 'epic-wafer-types-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicWaferTypesListComponent,
        EpicContentErrorMessagePipe,
    ],
})
export class EpicWaferTypesListPageComponent extends BaseComponent {

    readonly entitiesList: Signal<EpicWaferType[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly router = inject(Router)
    protected readonly store = inject(Store)
    protected readonly epicWaferTypeCreateDialogService = inject(EpicWaferTypeCreateDialogService)
    protected readonly epicWaferTypeDetailsDialogService = inject(EpicWaferTypeDetailsDialogService)

    constructor() {
        super()
        this.dataFetchingProcessing = this.store.selectSignal(StoreSelectors.selectFetchAllProcessing)
        this.entitiesList = this.store.selectSignal(StoreSelectors.selectAllWaferTypes)

        this.store.dispatch(
            StoreActions.fetchAllRequestAction({}),
        )
    }

    onReload(): void {
        this.store.dispatch(
            StoreActions.fetchAllRequestAction({ force: true }),
        )
    }

    onRowClicked(rowData: EpicWaferType) {
        this.openDetailsDialog(rowData)
    }

    onRowDetails(rowData: EpicWaferType): void {
        this.openDetailsDialog(rowData)
    }

    onRowClone(rowData: EpicWaferType): void {
        this.epicWaferTypeCreateDialogService.openDialog(rowData.id, { isClone: true })
    }

    // onRowEdit(rowData: EpicWaferType): void {
    //     this.epicWaferTypeCreateDialogService.openDialog(rowData.id)
    // }

    onCreate(): void {
        this.epicWaferTypeCreateDialogService.openDialog()
    }

    private openDetailsDialog(entity: EpicWaferType): void {
        this.epicWaferTypeDetailsDialogService.openDialog(entity)
    }

}
