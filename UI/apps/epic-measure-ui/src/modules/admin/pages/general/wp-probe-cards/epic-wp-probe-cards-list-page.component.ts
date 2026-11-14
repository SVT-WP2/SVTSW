import { Component, inject, Signal } from '@angular/core'
import { MatTooltip } from '@angular/material/tooltip'
import { Router } from '@angular/router'
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
    EpicWpProbeCardDetailsDialogService,
    EpicWpProbeCardsActions,
    EpicWpProbeCardsListComponent,
    EpicWpProbeCardsSelectors,
} from 'epic-ui/shared/wp'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { EpicWpProbeCard } from 'svt-ts-types'

import StoreActions = EpicWpProbeCardsActions
import StoreSelectors = EpicWpProbeCardsSelectors


@Component({
    selector: 'epic-wp-probe-cards-list-page',
    templateUrl: 'epic-wp-probe-cards-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicWpProbeCardsListComponent,
        EpicContentErrorMessagePipe,
    ],
})
export class EpicWpProbeCardsListPageComponent extends BaseComponent {

    readonly entitiesList: Signal<EpicWpProbeCard[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly router = inject(Router)
    protected readonly store = inject(Store)
    protected readonly epicWpProbeCardDetailsDialog = inject(EpicWpProbeCardDetailsDialogService)

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

    onRowDetails(rowData: EpicWpProbeCard): void {
        this.epicWpProbeCardDetailsDialog.openDialog(rowData)
    }

}
