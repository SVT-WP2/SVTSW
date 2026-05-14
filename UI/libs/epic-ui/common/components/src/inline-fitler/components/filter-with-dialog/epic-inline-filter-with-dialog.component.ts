import { Component, EventEmitter, Input, Output, TemplateRef, ViewChild } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatDialog, MatDialogConfig, MatDialogModule, MatDialogRef } from '@angular/material/dialog'
import { MatTooltip } from '@angular/material/tooltip'
import { TranslateModule } from '@ngx-translate/core'
import { BaseComponent } from 'epic-ui/utils'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { take } from 'rxjs/operators'

import { EpicButtonModule } from '../../../button'
import { EpicDotDividerComponent } from '../../../dot-divider'
import { EpicIconComponent } from '../../../icon'
import { EpicMatDialogModule } from '../../../mat-dialog'
import { EpicInlineFilterComponent } from '../inline-filter'

import DialogSize = MatDialogHelpers.DialogSize


@Component({
    selector: 'epic-inline-filter-with-dialog',
    templateUrl: './epic-inline-filter-with-dialog.component.html',
    imports: [
        TranslateModule,
        MatButtonModule,
        MatDialogModule,
        EpicIconComponent,
        EpicDotDividerComponent,
        EpicInlineFilterComponent,
        EpicMatDialogModule,
        EpicButtonModule,
        MatTooltip,
    ],
})
export class EpicInlineFilterWithDialogComponent extends BaseComponent {

    @Input() label: string
    @Input() icon: string
    @Input() isActive: boolean
    @Input() selectedItemsNumber: number
    @Input() applyItemsNumber: number
    @Input() dialogTitle: string
    @Input() dialogConfig: MatDialogConfig = MatDialogHelpers.getDefaultConfig(DialogSize.Medium)

    @Input() showClearBtn = true
    @Input() showApplyBtn = true
    @Input() applyBtnDisabled = false

    @Output() apply$ = new EventEmitter<void>()
    @Output() clear$ = new EventEmitter<void>()
    @Output() dialogClosed$ = new EventEmitter<void>()
    @Output() dialogOpened$ = new EventEmitter<void>()

    @ViewChild('dialogTmpl') dialogTmpl = {} as TemplateRef<any>

    isOpened = false

    private dialogRef: MatDialogRef<any>

    constructor(private readonly matDialog: MatDialog) {
        super()
    }

    onOpenDialog(): void {
        this.dialogRef = this.matDialog.open(
            this.dialogTmpl,
            this.dialogConfig,
        )

        this.dialogRef.afterClosed()
            .pipe(
                take(1),
            )
            .subscribe(() => {
                this.isOpened = false
                this.dialogClosed$.emit()
            })

        this.dialogRef.afterOpened()
            .pipe(
                take(1),
            )
            .subscribe(() => {
                this.isOpened = true
                this.dialogOpened$.emit()
            })
    }

    onClearBtnClicked(): void {
        this.clear$.emit()
    }

    onApplyBtnClicked(): void {
        this.apply$.emit()
        this.closeDialog()
    }

    private closeDialog(): void {
        this.dialogRef.close()
    }

}
