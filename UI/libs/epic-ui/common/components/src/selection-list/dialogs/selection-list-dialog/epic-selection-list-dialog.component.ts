import { AsyncPipe } from '@angular/common'
import { Component, computed, EventEmitter, inject, Input, model, Output } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogClose } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { BaseComponent, EpicSearchPipe, ProcessingStore, SelectOptionLabelValue, TypeHelpers } from 'epic-ui/utils'
import { isNil } from 'lodash-es'
import { Observable, of } from 'rxjs'

import { EpicButtonModule } from '../../../button'
import { EpicContentErrorModule } from '../../../content-error'
import { EpicGenericContentRendererComponent } from '../../../content-renderer'
import { EpicDotDividerComponent } from '../../../dot-divider'
import { EpicLoaderComponent } from '../../../loader'
import { EpicMatDialogModule } from '../../../mat-dialog'
import { EpicSearchBoxModule } from '../../../search-box'
import { EpicSelectionToggleComponent } from '../../../selection-toggle'
import {
    EpicSelectionListBoxWrapperComponent,
    EpicSelectionListVirtualScrollComponent,
    EpicSelectOptionRendererComponent,
} from '../../components'
import { EpicSelectionListOptionDirective } from '../../directives'
import { EpicSelectionListDialog } from '../../models'

import Dialog = EpicSelectionListDialog


@Component({
    selector: 'epic-selection-list-dialog',
    templateUrl: './epic-selection-list-dialog.component.html',
    imports: [
        EpicMatDialogModule,
        TranslatePipe,
        EpicLoaderComponent,
        MatButton,
        MatDialogClose,
        EpicDotDividerComponent,
        EpicContentErrorModule,
        FormsModule,
        EpicSelectOptionRendererComponent,
        EpicGenericContentRendererComponent,
        EpicSelectionListBoxWrapperComponent,
        EpicSearchBoxModule,
        EpicSelectionListVirtualScrollComponent,
        EpicButtonModule,
        EpicSelectionToggleComponent,
        AsyncPipe,
        EpicSearchPipe,
        EpicSelectionListOptionDirective,
    ],
})
export class EpicSelectionListDialogComponent<TRecord = unknown, TValue = TRecord> extends BaseComponent {

    @Input() submitProcessing: ProcessingStore.EventProcessingState = ProcessingStore.getDefaultProcessingState()
    @Input() initProcessing: ProcessingStore.EventProcessingState = ProcessingStore.getDefaultProcessingState(true)
    @Input() selectOptions: SelectOptionLabelValue<TValue, TRecord>[]

    @Output() submit$ = new EventEmitter<Dialog.SubmitPayload<TValue>>()

    readonly dialogData = inject<Dialog.DialogData<TRecord, TValue>>(MAT_DIALOG_DATA)
    readonly submitButtonText = this.dialogData.submitButtonText ?? 'COMMON.SELECT'
    readonly selectedValues = model<TValue | TValue[] | null>()
    readonly selectedValuesArray = computed<TValue[]>(() => {
        if (isNil(this.selectedValues())) {
            return []
        }
        return this.dialogData.multiple ? (this.selectedValues() as TValue[]) : [this.selectedValues() as TValue]
    })

    readonly contentHeaderRendererParams$: Observable<unknown>

    searchValue: string

    constructor() {
        super()

        this.contentHeaderRendererParams$ = this.dialogData.contentHeaderRenderer?.params
            ? TypeHelpers.toObservable(this.dialogData.contentHeaderRenderer.params)
            : of(undefined)
    }

    onSubmitBtnClicked(): void {
        this.submit$.emit({
            selectedValues: this.selectedValuesArray(),
        })
    }

    onSelectAll(): void {
        this.selectedValues.set(
            this.selectOptions.map(item => item.value),
        )
    }

    onClear(): void {
        this.selectedValues.set(this.dialogData?.multiple ? [] : null)
    }

}
