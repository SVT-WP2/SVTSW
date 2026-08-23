import { Component, inject, OnDestroy, Signal } from '@angular/core'
import { MatTooltip } from '@angular/material/tooltip'
import { ActivatedRoute, Router } from '@angular/router'
import { Store } from '@ngrx/store'
import { EpicSvtTestSetup } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicLoaderComponent,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicSvtTestSetupCreateDialogService,
    EpicSvtTestSetupsActions,
    EpicSvtTestSetupsGrid,
    EpicSvtTestSetupsListComponent,
    EpicSvtTestSetupsSelectors,
} from 'epic-ui/shared/svt-tests'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import StoreSelectors = EpicSvtTestSetupsSelectors
import StoreActions = EpicSvtTestSetupsActions


@Component({
    selector: 'epic-svt-test-setups-list-page',
    templateUrl: 'epic-svt-test-setups-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicContentErrorMessagePipe,
        EpicSvtTestSetupsListComponent,
    ],
})
export class EpicSvtTestSetupsListPageComponent extends BaseComponent implements OnDestroy {

    readonly entitiesList: Signal<EpicSvtTestSetupsGrid.RowEntity[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly router = inject(Router)
    protected readonly store = inject(Store)
    protected readonly activatedRoute = inject(ActivatedRoute)
    protected readonly epicSvtTestSetupCreateDialogService = inject(EpicSvtTestSetupCreateDialogService)

    constructor() {
        super()
        this.entitiesList = this.store.selectSignal(StoreSelectors.selectAllTestSetups)
        this.dataFetchingProcessing = this.store.selectSignal(StoreSelectors.selectFetchAllProcessing)
        const isAllDataFetched = this.store.selectSignal(StoreSelectors.selectIsAllDataFetched)

        if (!isAllDataFetched()) {
            this.store.dispatch(
                StoreActions.fetchAllRequestAction({}),
            )
        }
    }

    ngOnDestroy(): void {
        super.ngOnDestroy()
        this.store.dispatch(
            StoreActions.leaveAction(),
        )
    }

    onReload(): void {
        this.store.dispatch(
            StoreActions.fetchAllRequestAction({ force: true }),
        )
    }

    onCreate(): void {
        this.epicSvtTestSetupCreateDialogService.openDialog()
    }

    onRowDetailsAction(rowData: EpicSvtTestSetup): void {
        void this.router.navigate(
            EpicSvtTestSetupsGrid.getDetailsRouterLink(rowData),
            { relativeTo: this.activatedRoute },
        )
    }

}
