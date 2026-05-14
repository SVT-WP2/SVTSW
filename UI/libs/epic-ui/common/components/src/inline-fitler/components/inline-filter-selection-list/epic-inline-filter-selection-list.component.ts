import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, contentChild, forwardRef, input, signal } from '@angular/core'
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ArrayHelpers, BaseFormValueControlComponent, EpicSearchI18nPipe, SelectOptionLabelValue } from 'epic-ui/utils'

import { EpicButtonModule } from '../../../button'
import { EpicSearchBoxComponent, EpicSearchBoxValueDirective } from '../../../search-box'
import {
    EpicSelectionListBoxWrapperComponent,
    EpicSelectionListOptionDirective,
    EpicSelectionListVirtualScrollComponent,
} from '../../../selection-list'
import { EpicSelectionToggleComponent } from '../../../selection-toggle'
import { EpicInlineFilterWithOverlayComponent } from '../filter-with-overlay'


@Component({
    selector: 'epic-inline-filter-selection-list',
    templateUrl: './epic-inline-filter-selection-list.component.html',
    imports: [
        NgTemplateOutlet,
        EpicInlineFilterWithOverlayComponent,
        EpicSelectionListBoxWrapperComponent,
        EpicSearchBoxComponent,
        EpicSelectionListVirtualScrollComponent,
        EpicSearchBoxValueDirective,
        FormsModule,
        EpicButtonModule,
        EpicSelectionListOptionDirective,
        EpicSelectionToggleComponent,
        EpicSearchI18nPipe,
    ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => EpicInlineFilterSelectionListComponent),
            multi: true,
        },
    ],
})
export class EpicInlineFilterSelectionListComponent<TValue = unknown, TData = unknown>
    extends BaseFormValueControlComponent<TValue[] | TValue | null> {

    // INPUTS
    readonly selectOptions = input.required<SelectOptionLabelValue<TValue, TData>[]>()
    readonly icon = input<string>()
    readonly isIconOnly = input<boolean>(false)
    readonly multiple = input<boolean>(true)
    readonly label = input<string>()
    readonly applyBtnLabel = input<string>()
    readonly applyBtnDisabled = input<boolean>(false)
    readonly selectionOptionHeight = input<number>(44)
    readonly suppressSearch = input<boolean>(false)
    readonly isActive = input<boolean | undefined>(undefined)

    readonly height = input<string>('360px')
    readonly width = input<string>('420px')

    readonly customOptionTemplate = contentChild(EpicSelectionListOptionDirective<TValue, TData>)

    // SIGNALS
    readonly selectionListValue = signal<TValue | TValue[] | null>(null)
    readonly isFirstOpenProcessed = signal<boolean>(false)

    readonly selectionListValueArray = computed<TValue[]>(() => (
        ArrayHelpers.toArrayValue(this.selectionListValue(), this.multiple())
    ))

    searchValue = ''

    onSelectAll() {
        const allValue = this.selectOptions().map(item => item.value)
        this.selectionListValue.set(allValue)
    }

    onDeselectAll() {
        this.selectionListValue.set(this.multiple() ? [] : null)
    }

    onApply() {
        this.value = this.selectionListValue()
        this.onChange(this.value)
    }

    onPanelClosed() {
        this.selectionListValue.set(this.value)
    }

    onPanelOpen() {
        if (!this.isFirstOpenProcessed()) {
            this.isFirstOpenProcessed.set(true)
        }
        this.searchValue = ''
    }

    override writeValue(value: TValue[]) {
        super.writeValue(value)
        this.selectionListValue.set(this.value)
    }

    protected get arrayValue(): TValue[] {
        return ArrayHelpers.toArrayValue(this.value, this.multiple())
    }

}
