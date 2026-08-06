import { Component, inject, OnDestroy, OnInit, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { MatTooltip } from '@angular/material/tooltip'
import { EpicSvtTestTemplate } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
    EpicIconComponent,
    EpicLoaderComponent,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicSvtTestCreateDialogService,
    EpicSvtTestsGrid,
    EpicSvtTestsGridDataSource,
    EpicSvtTestsListComponent,
} from 'epic-ui/shared/svt-test/tests'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'


@Component({
    selector: 'epic-svt-tests-list-page',
    templateUrl: 'epic-svt-tests-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicContentErrorMessagePipe,
        EpicSvtTestsListComponent,
    ],
})
export class EpicSvtTestsListPageComponent extends BaseComponent implements OnInit, OnDestroy {

    readonly entitiesList: Signal<EpicSvtTestsGrid.RowEntity[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly dataSource = inject(EpicSvtTestsGridDataSource)
    protected readonly epicSvtTestCreateDialogService = inject(EpicSvtTestCreateDialogService)

    constructor() {
        super()
        this.entitiesList = toSignal(this.dataSource.data$)
        this.dataFetchingProcessing = toSignal(this.dataSource.loadingProcessing$)
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
        this.epicSvtTestCreateDialogService.openDialog({
            onSuccess: () => this.onReload(),
        })
    }

    onEdit(entity: EpicSvtTestTemplate): void {
        console.log('NOT IMPLEMENTED')
    }

    onRowClicked(entity: EpicSvtTestTemplate): void {
        console.log('NOT IMPLEMENTED')
    }

}

