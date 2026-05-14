import {
    AfterContentInit,
    Component,
    ContentChildren,
    EventEmitter,
    forwardRef,
    Input,
    Output,
    QueryList,
    TemplateRef,
    ViewChild,
} from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { NgSelectComponent } from '@ng-select/ng-select'

import { EpicSearchBoxComponent } from '../../../search-box'
import { EpicSelectTemplateDirective } from '../../directives/template/epic-select-template.directive'
import { EpicSelect } from '../../models'


@Component({
    selector: 'epic-select',
    templateUrl: './epic-select.component.html',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => EpicSelectComponent),
            multi: true,
        },
    ],
    standalone: false,
})
export class EpicSelectComponent<T = unknown> implements ControlValueAccessor, AfterContentInit {

    @Input() label: string
    @Input() options: T[]
    @Input() tabIndex: number
    @Input() placeholder = 'COMMON.SELECT__NULL_VALUE_OPTION_LABEL'
    @Input() notFoundText = 'COMMON.NO_OPTIONS_FOUND'
    @Input() loadingText = 'COMMON.LOADING'
    @Input() customClass: string | string[]
    @Input() size: EpicSelect.Size = EpicSelect.Size.basic

    // data binding
    @Input() bindLabel: string
    @Input() bindValue: string
    @Input() groupBy: string | (() => string)
    @Input() groupValue: EpicSelect.GroupValueFn
    @Input() trackByFn: (option: T) => any

    // search
    @Input() searchable = true

    // system
    @Input() loadingMore = false
    @Input() loading = false
    @Input() appendTo = 'body'
    @Input() compareWith: EpicSelect.CompareWithFn<T>
    @Input() disabled = false
    @Input() readonly = false
    @Input() clearable = false
    @Input() virtualScroll = false
    @Input() inputId = Math.random().toString(36).substring(2)
    @Input() dropdownPosition: 'top' | 'bottom' | 'auto' = 'auto'

    @Output() search$ = new EventEmitter<string>()
    @Output() scrollToEnd$ = new EventEmitter<void>()
    @Output() scroll$ = new EventEmitter<{ start: number; end: number }>()
    @Output() panelOpened$ = new EventEmitter<void>()
    @Output() panelClosed$ = new EventEmitter<void>()

    @ContentChildren(EpicSelectTemplateDirective) contentTemplatesQueryList: QueryList<EpicSelectTemplateDirective>
    @ViewChild('searchBoxRef', { static: false }) searchBoxRef: EpicSearchBoxComponent
    @ViewChild('ngSelect', { static: false }) ngSelect: NgSelectComponent

    templatesCollection: Partial<{ [K in EpicSelect.TemplateName]: TemplateRef<any> }> = {}
    value: any

    currentSearchTerm: string

    readonly TemplateName = EpicSelect.TemplateName
    readonly Size = EpicSelect.Size

    constructor() {
    }

    onChange: any = () => {
    }

    onTouch: any = () => {
    }

    ngAfterContentInit(): void {
        // calculate templates collection
        this.templatesCollection = this.contentTemplatesQueryList
            .reduce<Partial<{ [K in EpicSelect.TemplateName]: TemplateRef<any> }>>(
                (result, item) => {
                    const templateName = item.templateName
                    result[templateName] = item.template
                    return result
                },
                {},
            )
    }

    registerOnChange(fn: any): void {
        this.onChange = fn
    }

    registerOnTouched(fn: any): void {
        this.onTouch = fn
    }

    writeValue(value: any): void {
        if (this.value !== value) {
            this.value = value
            this.onChange(value)
        }
    }

    setDisabledState(isDisabled: boolean): void {
        this.disabled = isDisabled
    }

    onScrollToEnd(): void {
        this.scrollToEnd$.emit()
    }

    onScroll($event: { start: number; end: number }): void {
        this.scroll$.emit($event)
    }

    onSearch(searchTerm: string): void {
        this.currentSearchTerm = searchTerm
        this.search$.emit(searchTerm)
    }

    onPanelOpened(): void {
        this.panelOpened$.emit()

        if (this.searchable) {
            // reset search term
            this.currentSearchTerm = ''
            // focus search box
            setTimeout(
                () => this.searchBoxRef.focusSearchInput(),
                100, // give some time to search box to init itself.
            )
        }
    }

    onPanelClosed(): void {
        this.panelClosed$.emit()
    }

    panelScrollTop(): void {
        (this.ngSelect.dropdownPanel.scrollElementRef.nativeElement as HTMLElement).scrollTop = 0
    }

    close(): void {
        this.ngSelect.close()
    }

}
