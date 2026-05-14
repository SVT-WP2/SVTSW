import { Component, inject, OnDestroy, OnInit, Signal, ViewContainerRef } from '@angular/core'
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
    EpicSvtTestTemplateCreateDialogService,
    EpicSvtTestTemplateGrid,
    EpicSvtTestTemplateGridDataSource,
    EpicSvtTestTemplateListComponent,
    EpicSvtTestTemplateUpdateDialogService,
} from 'epic-ui/shared/svt-test/test-templates'
import { EpicSvtTestTypeConfigsDataFacade, EpicSvtTestTypesDataFacade } from 'epic-ui/shared/svt-test/test-types'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'


@Component({
    selector: 'epic-svt-test-templates-list-page',
    templateUrl: 'epic-svt-test-templates-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicContentErrorMessagePipe,
        EpicSvtTestTemplateListComponent,
    ],
})
export class EpicSvtTestTemplatesListPageComponent extends BaseComponent implements OnInit, OnDestroy {

    readonly entitiesList: Signal<EpicSvtTestTemplateGrid.RowEntity[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly dataSource = inject(EpicSvtTestTemplateGridDataSource)
    protected readonly epicSvtTestTemplateCreateDialogService = inject(EpicSvtTestTemplateCreateDialogService)
    protected readonly epicSvtTestTemplateUpdateDialogService = inject(EpicSvtTestTemplateUpdateDialogService)
    protected readonly epicSvtTestTypeConfigsDataFacade = inject(EpicSvtTestTypeConfigsDataFacade)
    protected readonly epicSvtTestTypesDataFacade = inject(EpicSvtTestTypesDataFacade)
    protected readonly viewContainerRef = inject(ViewContainerRef)

    constructor() {
        super()
        this.entitiesList = toSignal(this.dataSource.data$)
        this.dataFetchingProcessing = toSignal(this.dataSource.loadingProcessing$)
        // we need to reset cache as it is shared and can be already filled with old data
        this.epicSvtTestTypeConfigsDataFacade.resetCache()
        this.epicSvtTestTypesDataFacade.resetCache()
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
        this.epicSvtTestTemplateCreateDialogService.openDialog({
            onSuccess: () => this.dataSource.load(true),
            viewContainerRef: this.viewContainerRef,
        })
    }

    onEdit(entity: EpicSvtTestTemplate): void {
        this.processRowEditAction(entity)
    }

    onRowClicked(entity: EpicSvtTestTemplate): void {
        this.processRowEditAction(entity)
    }

    private processRowEditAction(entity: EpicSvtTestTemplate): void {
        this.epicSvtTestTemplateUpdateDialogService.openDialog(entity, {
            onSuccess: () => this.dataSource.load(true),
        })
    }

}

