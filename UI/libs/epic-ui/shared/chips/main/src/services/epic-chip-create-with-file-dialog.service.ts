import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicChip, EpicChipCreate, EpicChipCreateManyItem, EpicChipsApiClient } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { NgxCsvParser } from 'ngx-csv-parser'
import { catchError, forkJoin, Observable, of, switchMap, takeUntil, tap, throwError } from 'rxjs'
import { map } from 'rxjs/operators'

import { EpicChipCreateWithFileDialog, EpicChipCreateWithFileDialogComponent } from '../dialogs'
import { EpicChipCreateWithFileForm } from '../forms'

import { EpicChipCreateManyPreviewDialogService } from './epic-chip-create-many-preview-dialog.service'

import Dialog = EpicChipCreateWithFileDialog
import Form = EpicChipCreateWithFileForm
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicChipCreateWithFileDialogService {

    protected readonly dialog = inject(MatDialog)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicChipsApiClient = inject(EpicChipsApiClient)
    protected readonly ngxCsvParser = inject(NgxCsvParser)
    protected readonly epicChipCreateManyPreviewDialogService = inject(EpicChipCreateManyPreviewDialogService)

    openDialog(payload?: { onSuccess?: (chips: EpicChip[]) => void }): void {
        const { onSuccess } = payload || {}
        const dialogRef = MatDialogHelpers.openDialog<EpicChipCreateWithFileDialogComponent, Dialog.Data>(
            this.dialog,
            EpicChipCreateWithFileDialogComponent,
            {},
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )

        dialogRef.componentInstance.submit$
            .pipe(
                tap(() => dialogRef.componentInstance.isProcessing = true),
                takeUntil(dialogRef.componentInstance.destroyed$),
                switchMap((formData) => forkJoin([
                    of(formData),
                    this.parseAsicToChipMapFile(formData[Form.FormField.asicToChipMap]!),
                ])),
                switchMap(([formData, createManyItems]) => this.epicChipsApiClient.createMany({
                    generalLocation: formData[Form.FormField.generalLocation],
                    items: createManyItems,
                })),
                catchError((error: HttpErrorResponse) => {
                    dialogRef.componentInstance.processingError = error.message
                    this.epicNotificationService.error(dialogRef.componentInstance.processingError, 'Processing Error')
                    dialogRef.componentInstance.isProcessing = false
                    return throwError(() => error)
                }),
            )
            .subscribe((entities: EpicChip[]) => {
                dialogRef.componentInstance.isProcessing = false
                this.epicNotificationService.doneMessage()
                if (onSuccess) {
                    onSuccess(entities)
                }
                dialogRef.close()
            })

        dialogRef.componentInstance.preview$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                switchMap((formData) => forkJoin([
                    of(formData),
                    this.parseAsicToChipMapFile(formData[Form.FormField.asicToChipMap]!),
                ])),
                map(
                    ([formData, createManyItems]) =>
                        createManyItems
                            .map<EpicChipCreate>(item => ({
                                ...item,
                                generalLocation: formData[Form.FormField.generalLocation],
                            })),
                ),
                catchError((error: HttpErrorResponse) => {
                    this.epicNotificationService.error(error.message, 'Unable to parse File')
                    return throwError(() => error)
                }),
            )
            .subscribe((data) => {
                this.epicChipCreateManyPreviewDialogService.openDialog({ data })
            })
    }

    protected parseAsicToChipMapFile(asicToChipMapFile: File): Observable<EpicChipCreateManyItem[]> {
        return this.ngxCsvParser.parse(asicToChipMapFile, { delimiter: ',', header: false })
            .pipe(
                map(asicToChipMapCsvContent => Form.parseAsicToChipMapFileContent(asicToChipMapCsvContent as string[][])),
            )
    }

}
