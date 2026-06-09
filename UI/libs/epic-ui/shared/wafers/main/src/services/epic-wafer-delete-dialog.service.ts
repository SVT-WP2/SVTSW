import { inject, Injectable } from '@angular/core'
import { MatDialog, MatDialogRef } from '@angular/material/dialog'
import { EpicConfirmDialogComponent, EpicConfirmDialogControl, EpicNotificationService } from 'epic-ui/common/components'
import { first, of, switchMap, tap, throwError } from 'rxjs'

import { EpicWafersStoreFacade } from '../store'


@Injectable()
export class EpicWaferDeleteDialogService {

    protected readonly dialog = inject(MatDialog)
    protected readonly store = inject(EpicWafersStoreFacade)
    protected readonly epicNotificationService = inject(EpicNotificationService)

    openDialog(waferId: number): MatDialogRef<EpicConfirmDialogComponent> {
        return EpicConfirmDialogControl.showDeleteConfirmDialog(
            this.dialog,
            () => {
                this.store.actionDeleteOne(waferId)
                return this.store.deleteProcessingEvents.processingEnd$
                    .pipe(
                        first(),
                        switchMap(state => {
                            return state.deleteProcessing.processingError
                                ? throwError(() => state.deleteProcessing.processingError)
                                : of(state)
                        }),
                        tap(() => this.epicNotificationService.doneMessage()),
                    )
            },
        )
    }

}
