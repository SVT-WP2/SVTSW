import { Component, inject, OnDestroy, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { MatCardModule } from '@angular/material/card'
import { MatTooltip } from '@angular/material/tooltip'
import { Router } from '@angular/router'
import { EpicAsic } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicLoaderComponent,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicAsicCreateDialogService, EpicAsicsListComponent, EpicAsicsStoreFacade } from 'epic-ui/shared/asics'
import { EpicWafersStoreFacade } from 'epic-ui/shared/wafers'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'


@Component({
    selector: 'epic-asics-list-page',
    templateUrl: 'epic-asics-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicButtonModule,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicContentErrorModule,
        MatCardModule,
        EpicAsicsListComponent,
        EpicContentErrorMessagePipe,
    ],
})
export class EpicAsicsListPageComponent extends BaseComponent implements OnDestroy {

    readonly asicsList: Signal<EpicAsic[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly asicsStore = inject(EpicAsicsStoreFacade)
    protected readonly wafersStore = inject(EpicWafersStoreFacade)
    protected readonly router = inject(Router)
    protected readonly epicAsicCreateDialogService = inject(EpicAsicCreateDialogService)

    constructor() {
        super()
        this.asicsList = toSignal(this.asicsStore.asicsList$)
        this.dataFetchingProcessing = toSignal(this.asicsStore.fetchAllProcessing$)
        this.wafersStore.actionFetchAll()
        this.asicsStore.actionFetchAll({ waferId: null })
    }

    onReload(): void {
        this.asicsStore.actionFetchAll({ force: true })
    }

    onRowClicked(rowData: EpicAsic) {
        void this.router.navigate(['/asics/details', rowData.id])
    }

    override ngOnDestroy(): void {
        super.ngOnDestroy()
        // this.asicsStore.disconnect()
    }

    onCreate(): void {
        this.epicAsicCreateDialogService.openDialog()
    }

}
