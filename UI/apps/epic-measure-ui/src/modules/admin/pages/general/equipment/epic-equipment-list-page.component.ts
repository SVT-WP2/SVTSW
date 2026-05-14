import { Component, inject, OnDestroy, OnInit, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { MatTooltip } from '@angular/material/tooltip'
import { EpicEquipment } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicLoaderComponent,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicEquipmentCreateDialogService,
    EpicEquipmentGrid,
    EpicEquipmentGridDataSource,
    EpicEquipmentListComponent,
    EpicEquipmentLocationHistoryDialogService,
    EpicEquipmentLocationUpdateDialogService,
} from 'epic-ui/shared/equipment'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'


@Component({
    selector: 'epic-equipment-list-page',
    templateUrl: 'epic-equipment-list-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicEquipmentListComponent,
        EpicContentErrorMessagePipe,
    ],
})
export class EpicEquipmentListPageComponent extends BaseComponent implements OnInit, OnDestroy {

    readonly entitiesList: Signal<EpicEquipment[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly dataSource = inject(EpicEquipmentGridDataSource)
    protected readonly epicEquipmentCreateDialogService = inject(EpicEquipmentCreateDialogService)
    protected readonly epicEquipmentLocationHistoryDialogService = inject(EpicEquipmentLocationHistoryDialogService)
    protected readonly epicEquipmentLocationUpdateDialogService = inject(EpicEquipmentLocationUpdateDialogService)

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
        this.epicEquipmentCreateDialogService.openDialog({
            onSuccess: () => this.dataSource.load(true),
        })
    }

    onGridLocationHistory(rowData: EpicEquipmentGrid.RowEntity) {
        void this.epicEquipmentLocationHistoryDialogService.openDialog(rowData.id)
    }

    onGridUpdateLocation(rowData: EpicEquipmentGrid.RowEntity): void {
        this.epicEquipmentLocationUpdateDialogService.openDialog(
            rowData.id,
            {
                onSuccess: () => this.onReload(),
            },
        )
    }

}
