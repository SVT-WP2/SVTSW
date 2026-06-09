import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete'
import { MatTooltip } from '@angular/material/tooltip'
import { TranslatePipe } from '@ngx-translate/core'
import { BaseComponent } from 'epic-ui/utils'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators'

import { EpicIconComponent } from '../icon'


@Component({
    selector: 'epic-search-box',
    templateUrl: './epic-search-box.component.html',
    imports: [
        FormsModule,
        TranslatePipe,
        MatAutocompleteTrigger,
        MatTooltip,
        EpicIconComponent,
    ],
})
export class EpicSearchBoxComponent extends BaseComponent {

    @ViewChild('inputRef', { read: ElementRef, static: true }) inputRef: ElementRef<HTMLElement>

    @Input() placeholder = 'COMMON.SEARCH_PLACEHOLDER'
    @Input() matAutocomplete: MatAutocomplete

    @Input() set searchTerm(value: string) {
        this.inputValue = value
    }

    @Output() search$ = new EventEmitter<string>()
    @Output() clear$ = new EventEmitter<void>()

    isFocused = false
    inputValue: string

    readonly emitSearchEventDebounceTimeInUs = 300

    protected searchValueChanged$ = new Subject<string>()

    constructor() {
        super()

        this.searchValueChanged$
            .pipe(
                takeUntil(this.destroyed$),
                // wait some time between keyUp events
                debounceTime(this.emitSearchEventDebounceTimeInUs),
                // emit only different value form the previous one
                distinctUntilChanged((a, b) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()),
            )
            .subscribe(
                value => this.search$.emit(value),
            )
    }

    onSearchChanged(searchTerm: string): void {
        this.inputValue = searchTerm
        this.searchValueChanged$.next(searchTerm)
        this.isFocused = true
    }

    onClearBtnClicked(): void {
        this.onSearchChanged('')
        this.focusSearchInput()
        this.clear$.emit()
    }

    focusSearchInput(): void {
        this.inputRef.nativeElement.focus()
    }

    clearFocus(): void {
        this.isFocused = false
    }

}
