import { Component, inject } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicMatDialogModule } from 'epic-ui/common/components'

import { EpicChipCreateManyPreviewGridComponent } from '../../components'

import { EpicChipCreateManyPreviewDialog } from './epic-chip-create-many-preview-dialog.models'

import Dialog = EpicChipCreateManyPreviewDialog


@Component({
    selector: 'epic-chip-create-many-preview-dialog',
    templateUrl: './epic-chip-create-many-preview-dialog.component.html',
    standalone: true,
    imports: [
        MatDialogModule,
        MatButton,
        TranslatePipe,
        EpicMatDialogModule,
        EpicChipCreateManyPreviewGridComponent,
    ],
})
export class EpicChipCreateManyPreviewDialogComponent {

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

}
