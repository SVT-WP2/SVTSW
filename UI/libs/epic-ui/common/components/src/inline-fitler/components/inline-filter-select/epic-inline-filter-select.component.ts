import { NgStyle, NgTemplateOutlet } from '@angular/common'
import { Component, contentChild, forwardRef, input, signal, viewChild } from '@angular/core'
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { BaseFormSignalValueControlComponent, EpicSearchI18nPipe, SelectOptionLabelValue } from 'epic-ui/utils'

import { EpicButtonModule } from '../../../button'
import { EpicSearchBoxComponent, EpicSearchBoxValueDirective } from '../../../search-box'
import { EpicSelectionListBoxWrapperComponent, EpicSelectionListComponent, EpicSelectionListOptionDirective } from '../../../selection-list'
import { EpicInlineFilterWithOverlayComponent } from '../filter-with-overlay'


@Component({
    selector: 'epic-inline-filter-select',
    templateUrl: './epic-inline-filter-select.component.html',
    imports: [
        NgTemplateOutlet,
        EpicInlineFilterWithOverlayComponent,
        EpicSelectionListBoxWrapperComponent,
        EpicSearchBoxComponent,
        EpicSearchBoxValueDirective,
        FormsModule,
        EpicButtonModule,
        EpicSelectionListOptionDirective,
        EpicSelectionListComponent,
        NgStyle,
        EpicSearchI18nPipe,
    ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => EpicInlineFilterSelectComponent),
            multi: true,
        },
    ],
})
export class EpicInlineFilterSelectComponent<TValue = unknown, TData = unknown>
    extends BaseFormSignalValueControlComponent<TValue> {

    // INPUTS
    readonly selectOptions = input.required<SelectOptionLabelValue<TValue, TData>[]>()
    readonly label = input<string>()
    readonly icon = input<string>()
    readonly isIconOnly = input<boolean>(false)
    readonly isActive = input<boolean | undefined>(undefined)
    readonly suppressSearch = input<boolean>(true)
    readonly overlayCustomStyles = input<Partial<CSSStyleDeclaration>>({})

    readonly customOptionTemplate = contentChild(EpicSelectionListOptionDirective<TValue, TData>)
    readonly epicInlineFilterWithOverlayComponent = viewChild(EpicInlineFilterWithOverlayComponent)

    // SIGNALS
    readonly isFirstOpenProcessed = signal<boolean>(false)

    searchValue = ''

    onPanelOpen() {
        if (!this.isFirstOpenProcessed()) {
            this.isFirstOpenProcessed.set(true)
        }
        this.searchValue = ''
    }

    onSelectionChanged(value: TValue): void {
        this.onChange(value)
        this.epicInlineFilterWithOverlayComponent()!.closePanel()
    }

}
