import { Component, inject, OnDestroy, OnInit, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { EpicWafer } from 'epic-ui/api'
import { EpicWaferCreateDialogService, EpicWaferDeleteDialogService, EpicWafersStoreFacade } from 'epic-ui/shared/wafers'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'


@Component({
    selector: 'epic-wafers-list-page',
    templateUrl: 'epic-wafers-list-page.component.html',
    standalone: false,
})
export class EpicWafersListPageComponent extends BaseComponent implements OnDestroy, OnInit {

    readonly wafersList: Signal<EpicWafer[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly store = inject(EpicWafersStoreFacade)
    protected readonly epicWaferDeleteDialogService = inject(EpicWaferDeleteDialogService)
    protected readonly epicWaferCreateDialogService = inject(EpicWaferCreateDialogService)

    constructor() {
        super()
        this.wafersList = toSignal(this.store.wafersList$)
        this.dataFetchingProcessing = toSignal(this.store.fetchAllProcessing$)
    }

    ngOnInit(): void {
        this.store.actionFetchAll()
    }

    ngOnDestroy(): void {
        super.ngOnDestroy()
    }

    onReload(): void {
        this.store.actionFetchAll({ force: true })
    }

    onRowDelete(rowData: EpicWafer): void {
        this.epicWaferDeleteDialogService.openDialog(rowData.id)
    }

    onRowClone(rowData: EpicWafer): void {
        this.epicWaferCreateDialogService.openDialog(rowData.id, { isClone: true })
    }

    onRowEdit(rowData: EpicWafer): void {
        this.epicWaferCreateDialogService.openDialog(rowData.id)
    }

    onCreate(): void {
        this.epicWaferCreateDialogService.openDialog()
    }

}
