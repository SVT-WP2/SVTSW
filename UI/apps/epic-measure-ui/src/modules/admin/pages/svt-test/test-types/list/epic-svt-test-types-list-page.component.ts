import { Component, inject, OnDestroy, Signal } from '@angular/core'
import { MatTooltip } from '@angular/material/tooltip'
import { ActivatedRoute, Router } from '@angular/router'
import { Store } from '@ngrx/store'
import { EpicSvtTestType, EpicSvtTestTypeConfig } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicLoaderComponent,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicSvtTestTypeCreateDialogService,
    EpicSvtTestTypesActions,
    EpicSvtTestTypesGrid,
    EpicSvtTestTypesListComponent,
    EpicSvtTestTypesSelectors,
} from 'epic-ui/shared/svt-test/test-types'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import StoreSelectors = EpicSvtTestTypesSelectors
import StoreActions = EpicSvtTestTypesActions


@Component({
    selector: 'epic-svt-test-types-list-page',
    templateUrl: 'epic-svt-test-types-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicContentErrorMessagePipe,
        EpicSvtTestTypesListComponent,
    ],
})
export class EpicSvtTestTypesListPageComponent extends BaseComponent implements OnDestroy {

    readonly entitiesList: Signal<EpicSvtTestTypesGrid.RowEntity[]>
    readonly allTestTypeConfigs: Signal<EpicSvtTestTypeConfig[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly router = inject(Router)
    protected readonly store = inject(Store)
    protected readonly activatedRoute = inject(ActivatedRoute)
    protected readonly epicSvtTestTypeCreateDialogService = inject(EpicSvtTestTypeCreateDialogService)

    constructor() {
        super()
        this.entitiesList = this.store.selectSignal(StoreSelectors.selectAllTestTypes)
        this.allTestTypeConfigs = this.store.selectSignal(StoreSelectors.selectAllTestTypeConfigs)
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
        this.epicSvtTestTypeCreateDialogService.openDialog()
    }

    onRowDetailsAction(rowData: EpicSvtTestType): void {
        void this.router.navigate(
            EpicSvtTestTypesGrid.getDetailsRouterLink(rowData, this.allTestTypeConfigs()),
            { relativeTo: this.activatedRoute },
        )
    }

}
