import { Component, computed, inject, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { MatDivider } from '@angular/material/divider'
import { MatPrefix } from '@angular/material/form-field'
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu'
import { MatTooltip } from '@angular/material/tooltip'
import { ActivatedRoute, Router } from '@angular/router'
import { GridApi } from 'ag-grid-community'
import { EpicAsic, EpicWafer } from 'epic-ui/api'
import { EpicAgGridCardHeaderComponent, EpicAgGridCardWrapperComponent } from 'epic-ui/common/ag-grid'
import {
    EpicButtonModule,
    EpicExpandIconDirective,
    EpicIconComponent,
    EpicIconMatOutlinedPipe,
    EpicLoaderComponent,
    EpicBreadcrumbs,
    EpicBreadcrumbsModule,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicAsicCreateDialogService, EpicAsicsStoreFacade } from 'epic-ui/shared/asics'
import { EpicChipCreateWithFileDialogService } from 'epic-ui/shared/chips'
import {
    EpicWaferAsicsGrid,
    EpicWaferAsicsListComponent,
    EpicWaferCreateDialogService,
    EpicWaferInfoComponent,
    EpicWaferLocationHistoryDialogService,
    EpicWaferLocationUpdateDialogService,
    EpicWafersStoreFacade,
} from 'epic-ui/shared/wafers'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { takeUntil } from 'rxjs'


@Component({
    selector: 'epic-wafer-details-page',
    templateUrl: 'epic-wafer-details-page.component.html',
    imports: [
        EpicLayoutLightModule,
        EpicBreadcrumbsModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        MatMenuTrigger,
        EpicButtonModule,
        EpicIconComponent,
        MatMenuItem,
        EpicWaferInfoComponent,
        MatDivider,
        MatPrefix,
        EpicAgGridCardWrapperComponent,
        EpicAgGridCardHeaderComponent,
        MatTooltip,
        EpicWaferAsicsListComponent,
        MatMenu,
        EpicIconMatOutlinedPipe,
        EpicContentErrorMessagePipe,
        EpicExpandIconDirective,
    ],
})
export class EpicWaferDetailsPageComponent extends BaseComponent {

    readonly asicsList: Signal<EpicAsic[]>
    readonly wafer: Signal<EpicWafer>
    readonly asicsFetchAllProcessing: Signal<ProcessingStore.EventProcessingState>
    readonly waferFetchOneProcessing: Signal<ProcessingStore.EventProcessingState>
    readonly breadcrumbs = computed<EpicBreadcrumbs.Breadcrumb[]>(() => [
        {
            id: 'list',
            label: 'Wafers',
            routerLink: '../../list',
        },
        {
            id: 'details',
            label: this.wafer() ? this.wafer().serialNumber : 'Details',
            active: true,
            disabled: true,
        },
    ])

    // DI
    protected readonly epicWaferLocationUpdateDialogService = inject(EpicWaferLocationUpdateDialogService)
    protected readonly epicWaferCreateDialogService = inject(EpicWaferCreateDialogService)
    protected readonly epicAsicCreateDialogService = inject(EpicAsicCreateDialogService)
    protected readonly asicsStore = inject(EpicAsicsStoreFacade)
    protected readonly wafersStore = inject(EpicWafersStoreFacade)
    protected readonly activatedRoute = inject(ActivatedRoute)
    protected readonly epicWaferLocationHistoryDialogService = inject(EpicWaferLocationHistoryDialogService)
    protected readonly epicChipCreateWithFileDialogService = inject(EpicChipCreateWithFileDialogService)
    protected readonly router = inject(Router)
    protected gridApi: GridApi<EpicWaferAsicsGrid.RowEntity>

    constructor() {
        super()
        this.asicsList = toSignal(this.asicsStore.selectWaferAsicsStream(this.waferId))
        this.wafer = toSignal(this.wafersStore.selectOneWaferStream(this.waferId))
        this.asicsFetchAllProcessing = toSignal(this.asicsStore.fetchAllProcessing$)
        this.waferFetchOneProcessing = toSignal(this.wafersStore.fetchOneProcessing$)

        this.wafersStore.actionFetchOne(this.waferId)
        this.asicsStore.actionFetchAll({ waferId: this.waferId })

        this.wafersStore.deleteProcessingEvents.success$
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe(() => {
                void this.router.navigate(['/wafers/list'])
            })
    }

    get waferId(): number {
        return +this.activatedRoute.snapshot.params['waferId']
    }

    onEdit(): void {
        this.epicWaferCreateDialogService.openDialog(this.wafer().id)
    }

    onAsicsReload(): void {
        this.asicsStore.actionFetchAll({ waferId: this.waferId, force: true })
    }

    onAsicRowClicked(rowData: EpicAsic): void {
        void this.router.navigate(['/asics/details', rowData.id])
    }

    onAsicClone(rowData: EpicAsic): void {
        this.epicAsicCreateDialogService.openDialog({
            asic: rowData,
            isClone: true,
            onSuccess: () => {
                this.asicsStore.actionFetchAll({ waferId: this.waferId, force: true })
            },
        })
    }

    onAsicCreate(): void {
        this.epicAsicCreateDialogService.openDialog({
            waferId: this.waferId,
            onSuccess: () => {
                this.asicsStore.actionFetchAll({ waferId: this.waferId, force: true })
            },
        })
    }

    onUpdateLocation(): void {
        this.epicWaferLocationUpdateDialogService.openDialog(this.waferId)
    }

    onOpenLocationHistory(): void {
        void this.epicWaferLocationHistoryDialogService.openDialog(this.waferId)
    }

    onCreateChip(): void {
        this.epicChipCreateWithFileDialogService.openDialog({
            onSuccess: (chips) => this.onAsicsReload(),
        })
    }

    onGridReady(gridApi: GridApi<EpicWaferAsicsGrid.RowEntity>): void {
        this.gridApi = gridApi
    }

    onAsicsGridExport(): void {
        this.gridApi.exportDataAsCsv({
            fileName: `wafer-${this.waferId}-asics-list.csv`,
        })
    }

}
