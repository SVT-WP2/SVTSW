import { SelectOptionLabelValue } from 'epic-ui/utils'
import { Observable } from 'rxjs'

import { EpicContentRendererFactoryConfig } from '../../../content-renderer'
import { EpicSelectOptionRendererFactory } from '../epic-select-option-renderer.models'


export namespace EpicSelectionListDialog {

    export type DialogData<TRecord = unknown, TValue = TRecord> = {
        dialogTitle: string
        selectOptions: SelectOptionLabelValue<TValue, TRecord>[] | Observable<SelectOptionLabelValue<TValue, TRecord>[]>
        multiple?: boolean
        trackBy?: (value: TValue) => string | number
        submitButtonText?: string
        itemHeight?: number
        selectOptionRenderer?: EpicSelectOptionRendererFactory
        contentHeaderRenderer?: EpicContentRendererFactoryConfig
    }

    export type SubmitPayload<TValue = unknown> = {
        selectedValues: TValue[]
    }

    export type SubmitProcessingFnPayload<TValue = unknown, TDialogRef = unknown> =
        & SubmitPayload<TValue>
        &
        {
            dialogRef: TDialogRef
        }

    export type SubmitProcessingFn<TValue = unknown, TDialogRef = unknown>
        = (payload: SubmitProcessingFnPayload<TValue, TDialogRef>) => void | Observable<unknown>

}
