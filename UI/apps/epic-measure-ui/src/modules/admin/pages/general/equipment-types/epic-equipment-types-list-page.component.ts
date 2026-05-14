import { Component, inject, Signal, OnInit, OnDestroy } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { MatTooltip } from '@angular/material/tooltip'
import { EpicEquipmentType } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicLoaderComponent,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicEquipmentTypeCreateDialogService,
    EpicEquipmentTypesDataSource,
    EpicEquipmentTypesListComponent,
} from 'epic-ui/shared/equipment-types'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'


@Component({
    selector: 'epic-equipment-types-list-page',
    templateUrl: 'epic-equipment-types-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicEquipmentTypesListComponent,
        EpicContentErrorMessagePipe,
    ],
})
export class EpicEquipmentTypesListPageComponent extends BaseComponent implements OnInit, OnDestroy {

    readonly entitiesList: Signal<EpicEquipmentType[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly dataSource = inject(EpicEquipmentTypesDataSource)
    protected readonly epicEquipmentTypeCreateDialogService = inject(EpicEquipmentTypeCreateDialogService)

    constructor() {
        super()
        this.entitiesList = toSignal(this.dataSource.data$)
        this.dataFetchingProcessing = toSignal(this.dataSource.loadingProcessing$)
    }
    
    ngOnInit(): void {
        this.dataSource.connect()
        this.dataSource.load()
    }
    
    ngOnDestroy(): void {
        super.ngOnDestroy()
        this.dataSource.disconnect()
    }

    onReload(): void {
        this.dataSource.load(true)
    }

    onCreate(): void {
        this.epicEquipmentTypeCreateDialogService.openDialog({
            onSuccess: () => this.dataSource.load(true),
        })
    }

}
