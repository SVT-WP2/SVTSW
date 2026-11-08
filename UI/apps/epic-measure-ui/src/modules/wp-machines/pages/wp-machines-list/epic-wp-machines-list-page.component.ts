import { Component, inject, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { MatTooltip } from '@angular/material/tooltip'
import { Router } from '@angular/router'
import { Actions, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import {
    EpicIconComponent,
    EpicButtonModule,
    EpicContentErrorModule,
    EpicLoaderComponent,
    EpicNotificationService, EpicContentErrorMessagePipe,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicEnumsFacade } from 'epic-ui/shared'
import {
    EpicWpMachineCardComponent,
    EpicWpMachinesActions,
    EpicWpMachinesSelectors,
} from 'epic-ui/shared/wp'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { takeUntil } from 'rxjs'
import { EpicEnumName, EpicWpMachine, EpicWpMachineUpdateLoadedWaferRequest } from 'svt-ts-types'

import StoreActions = EpicWpMachinesActions
import StoreSelectors = EpicWpMachinesSelectors


@Component({
    selector: 'epic-wp-machines-list-page',
    templateUrl: 'epic-wp-machines-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicButtonModule,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicWpMachineCardComponent,
        EpicContentErrorMessagePipe,
    ],
})
export class EpicWpMachinesListPageComponent extends BaseComponent {

    readonly entitiesList: Signal<EpicWpMachine[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>
    /** The choices of the cards' orientation select. */
    readonly orientationOptions: Signal<string[]>

    // DI
    protected readonly router = inject(Router)
    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicEnumsFacade = inject(EpicEnumsFacade)

    constructor() {
        super()
        this.dataFetchingProcessing = this.store.selectSignal(StoreSelectors.selectFetchAllProcessing)
        this.entitiesList = this.store.selectSignal(StoreSelectors.selectAllEntitiesList)
        this.orientationOptions = toSignal(this.epicEnumsFacade.fetchByEnumName(EpicEnumName.waferMapOrientation), { initialValue: [] })

        this.store.dispatch(
            StoreActions.fetchAllRequestAction({}),
        )

        this.actions$
            .pipe(
                ofType(StoreActions.updateInstalledProbeCardErrorAction),
                takeUntil(this.destroyed$),
            )
            .subscribe(() => {
                this.epicNotificationService.serverCommunicationError()
            })

        this.actions$
            .pipe(
                ofType(StoreActions.updateLoadedWaferErrorAction),
                takeUntil(this.destroyed$),
            )
            .subscribe(() => {
                this.epicNotificationService.serverCommunicationError()
            })
    }

    onReload(): void {
        this.store.dispatch(
            StoreActions.fetchAllRequestAction({ force: true }),
        )
    }

    onInstalledProbeCardChanged(wpMachineId: number, installedProbeCardId: number | null) {
        this.store.dispatch(
            StoreActions.updateInstalledProbeCardRequestAction({ wpMachineId, installedProbeCardId }),
        )
    }

    onLoadedWaferChanged(wpMachineId: number, update: EpicWpMachineUpdateLoadedWaferRequest) {
        this.store.dispatch(
            StoreActions.updateLoadedWaferRequestAction({ wpMachineId, ...update }),
        )
    }

}
