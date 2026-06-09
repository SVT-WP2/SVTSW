import { Component, inject } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card'
import { EpicWaferType } from 'epic-ui/api'
import { EpicWaferTypeDetailsDialogService, EpicWaferTypeInfoComponent } from 'epic-ui/shared/wafer-types'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-dev-wafer-type-details-page',
    templateUrl: 'epic-dev-wafer-type-details-page.component.html',
    imports: [
        MatCard,
        MatCardHeader,
        MatCardTitle,
        MatCardContent,
        MatButton,
        EpicWaferTypeInfoComponent,
    ],
})
export class EpicDevWaferTypeDetailsPageComponent extends BaseComponent {

    readonly waferType: EpicWaferType = {
        id: 1,
        name: 'ER1',
        engineeringRun: 'Eng. Run No. 1',
        foundry: 'Foundry Name #1',
        technology: 'Technology #1',
    }

    private readonly epicWaferTypeDetailsDialogService = inject(EpicWaferTypeDetailsDialogService)

    onOpenDialog(): void {
        this.epicWaferTypeDetailsDialogService.openDialog(this.waferType)
    }

}
