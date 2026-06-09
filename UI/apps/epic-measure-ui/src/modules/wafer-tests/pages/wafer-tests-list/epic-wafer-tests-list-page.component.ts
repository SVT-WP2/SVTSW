import { Component, inject, OnDestroy, Signal } from '@angular/core'
import { MatTooltip } from '@angular/material/tooltip'
import { ActivatedRoute, Router } from '@angular/router'
import { Store } from '@ngrx/store'
import {
    EpicIconComponent,
    EpicButtonModule,
    EpicContentErrorModule,
    EpicLoaderComponent,
    EpicContentErrorMessagePipe,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicWaferTestCreateDialogService,
    EpicWaferTestExtended,
    EpicWaferTestsActions,
    EpicWaferTestsListComponent,
    EpicWaferTestsSelectors,
} from 'epic-ui/shared/wafer-tests'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import StoreActions = EpicWaferTestsActions
import StoreSelectors = EpicWaferTestsSelectors


@Component({
    selector: 'epic-wafer-tests-list-page',
    templateUrl: 'epic-wafer-tests-list-page.component.html',
    imports: [
        MatTooltip,
        EpicIconComponent,
        EpicLayoutLightModule,
        EpicButtonModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicWaferTestsListComponent,
        EpicContentErrorMessagePipe,
    ],
})
export class EpicWaferTestsListPageComponent extends BaseComponent implements OnDestroy {

    readonly entitiesList: Signal<EpicWaferTestExtended[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly store = inject(Store)
    protected readonly router = inject(Router)
    protected readonly activatedRoute = inject(ActivatedRoute)
    protected readonly epicWaferTestCreateDialogService = inject(EpicWaferTestCreateDialogService)

    constructor() {
        super()
        this.dataFetchingProcessing = this.store.selectSignal(StoreSelectors.selectFetchAllProcessing)
        this.entitiesList = this.store.selectSignal(StoreSelectors.selectAllWaferTests)

        this.store.dispatch(
            StoreActions.fetchAllRequestAction({}),
        )
    }

    onReload(): void {
        this.store.dispatch(
            StoreActions.fetchAllRequestAction({ force: true }),
        )
    }

    onRowClicked(rowData: EpicWaferTestExtended) {
        this.goToDetailsPage(rowData)
    }

    onRowDetails(rowData: EpicWaferTestExtended): void {
        this.goToDetailsPage(rowData)
    }

    onCreate(): void {
        this.epicWaferTestCreateDialogService.openDialog()
    }

    onRowClone(rowData: EpicWaferTestExtended) {
        this.epicWaferTestCreateDialogService.openDialog(rowData.id)
    }

    protected goToDetailsPage(rowData: EpicWaferTestExtended): void {
        void this.router.navigate(
            ['../details', rowData.id],
            {
                relativeTo: this.activatedRoute,
            },
        )
    }

}
