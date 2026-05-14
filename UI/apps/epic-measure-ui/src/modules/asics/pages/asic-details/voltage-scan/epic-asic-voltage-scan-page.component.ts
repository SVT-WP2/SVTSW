import { Component, inject } from '@angular/core'
import { EpicIvMnt } from 'epic-ui/api'
import { EpicAsicIvMntDialogService } from 'epic-ui/shared/asics'
import { EpicAsicsIvMntStoreMock } from 'epic-ui/shared/iv-mnt/__mock__'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-asic-voltage-scan-page',
    templateUrl: 'epic-asic-voltage-scan-page.component.html',
    standalone: false,
})
export class EpicAsicVoltageScanPageComponent extends BaseComponent {

    asicIvMntsList: EpicIvMnt[] = EpicAsicsIvMntStoreMock.getAsicIvMntList()

    // DI
    protected readonly epicAsicIvMntDialogService = inject(EpicAsicIvMntDialogService)

    constructor() {
        super()
    }

    openDialog(): void {
        this.epicAsicIvMntDialogService.openDialog()
    }

    onAsicIvMntReload() {

    }

    onRowDelete(event: EpicIvMnt) {

    }

    onRowDetails(rowData: EpicIvMnt) {
        this.epicAsicIvMntDialogService.openDialog({ asicIvMnt: rowData })
    }

    onRowClicked(rowData: EpicIvMnt) {
        this.epicAsicIvMntDialogService.openDialog({ asicIvMnt: rowData })
    }

    onRowRepeat($event: EpicIvMnt) {
        throw new Error('Method not implemented.')
    }

}
