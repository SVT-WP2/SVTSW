import { COMMA, ENTER } from '@angular/cdk/keycodes'
import {
    AfterViewInit,
    Component,
    ContentChild,
    forwardRef,
    Injector,
    Input,
    OnInit,
    ViewChild,
} from '@angular/core'
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, NgControl, ValidationErrors, Validators } from '@angular/forms'
import { MatAutocomplete, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete'
import { MatChipInput } from '@angular/material/chips'
import { MatError, MatFormFieldAppearance } from '@angular/material/form-field'
import { BaseComponent } from 'epic-ui/utils'
import { isArray, isEqual, isNil } from 'lodash-es'
import { BehaviorSubject, combineLatest } from 'rxjs'
import { debounceTime, delay, distinctUntilChanged, map, startWith, takeUntil } from 'rxjs/operators'

import { EpicChipsAutocompleteFormControl } from './epic-chips-autocomplete-form-control.models'

import Value = EpicChipsAutocompleteFormControl.Value


@Component({
    selector: 'epic-chips-autocomplete-form-control',
    templateUrl: './epic-chips-autocomplete-form-control.component.html',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => EpicChipsAutocompleteFormControlComponent),
            multi: true,
        },
    ],
    standalone: false,
})
export class EpicChipsAutocompleteFormControlComponent
    extends BaseComponent
    implements ControlValueAccessor, OnInit, AfterViewInit {

    @ViewChild(MatAutocomplete) autocompleteRef: MatAutocomplete
    @ViewChild(MatAutocompleteTrigger) autocompleteTriggerRef: MatAutocompleteTrigger
    @ViewChild(MatChipInput) chipInputRef: MatChipInput
    @ContentChild(MatError) matError: MatError

    @Input() isMultipleSelection = false
    @Input() isCustomValueAllowed = true
    @Input() appearance: MatFormFieldAppearance
    @Input() label: string
    @Input() hint: string
    @Input() errorMessages: string[]

    readonly separatorKeysCodes: number[] = [ENTER, COMMA]
    readonly chipsFormControl = new FormControl<Value>([])
    readonly chipInputFormControl = new FormControl<EpicChipsAutocompleteFormControl.PreValue>('')

    filteredOptions: Value = []

    protected readonly options$ = new BehaviorSubject<Value>([])
    protected readonly inputType$
        = new BehaviorSubject<EpicChipsAutocompleteFormControl.InputType>(EpicChipsAutocompleteFormControl.InputType.text)

    constructor(
        protected readonly injector: Injector,
    ) {
        super()
    }

    get options(): Value {
        return this.options$.getValue()
    }

    @Input() set options(options: Value) {
        this.options$.next(options)
    }

    get disabled(): boolean {
        return this.chipsFormControl?.disabled
    }

    @Input() set disabled(disabled: boolean) {
        if (disabled) {
            this.chipsFormControl.disable()
        }
        else {
            this.chipsFormControl.enable()
        }
    }

    @Input() set errors(errors: ValidationErrors) {
        this.chipsFormControl.setErrors(errors)
    }

    @Input() set required(required: boolean) {
        this.chipsFormControl.setValidators(required ? [Validators.required] : [])
    }

    @Input() set inputType(inputType: EpicChipsAutocompleteFormControl.InputType) {
        this.inputType$.next(inputType ?? EpicChipsAutocompleteFormControl.InputType.text)
    }

    get inputType(): EpicChipsAutocompleteFormControl.InputType {
        return this.inputType$.getValue()
    }

    ngOnInit(): void {
        this.watchChipsControl()
        this.watchFilteredOptions()
    }

    ngAfterViewInit(): void {
        this.watchParentControl()
    }

    onChange: any = () => {
    }

    onTouch: any = () => {
    }

    registerOnChange(fn: any): void {
        this.onChange = fn
    }

    registerOnTouched(fn: any): void {
        this.onTouch = fn
    }

    writeValue(value: Value): void {
        if (isNil(value)) {
            this.chipsFormControl.setValue([])
        }
        else {
            const valuesList = isArray(value) ? value : [value]
            this.chipsFormControl.setValue(valuesList)

            if (valuesList.length) {
                this.chipsFormControl.markAsTouched()
            }
        }
    }

    setDisabledState(disabled: boolean): void {
        if (disabled) {
            this.chipsFormControl.disable()
        }
        else {
            this.chipsFormControl.enable()
        }
    }

    onRemoveChip(value: string | number): void {
        const valuesList = (this.chipsFormControl.value || []).filter(val => val !== value)
        this.chipsFormControl.setValue(valuesList)
    }

    onAddChip(value: EpicChipsAutocompleteFormControl.PreValue | null): void {
        if (value === null) {
            return
        }

        const newValue = EpicChipsAutocompleteFormControl.parseValue(value, this.inputType)
        const alreadyExists = (this.chipsFormControl.value || []).includes(newValue)
        const isValueAllowed = this.isCustomValueAllowed
            ? true
            : !!this.options?.find(opt => opt === value)

        if (!!newValue && !alreadyExists && isValueAllowed) {
            // Multiple Selection Allowed => Append the value
            // Multiple Selection Disabled => Set as the only value
            const newValuesList = this.isMultipleSelection
                ? [...(this.chipsFormControl.value || []), newValue]
                : [newValue]

            this.chipsFormControl.setValue(newValuesList)
        }

        if (this.autocompleteTriggerRef.panelOpen && !this.isMultipleSelection) {
            this.autocompleteTriggerRef.closePanel()
        }

        this.chipInputFormControl.reset()
        this.chipInputRef.clear()
    }

    onOptionSelected(event: MatAutocompleteSelectedEvent): void {
        this.onAddChip(event.option.value as string)
    }

    onAutocompleteOpenToggle(): void {
        if (this.autocompleteTriggerRef.panelOpen) {
            this.autocompleteTriggerRef.closePanel()
        }
        else {
            this.autocompleteTriggerRef.openPanel()
            this.chipInputRef.focus()
        }
    }

    onInputBlur(event: FocusEvent): void {
        this.onTouch()
        this.chipsFormControl.markAsTouched()
        this.chipInputFormControl.markAsTouched()

        // We need custom blur logic due to autocomplete events collision
        const relatedTarget = event.relatedTarget as HTMLElement
        const autocompletePanel = this.autocompleteRef?.panel?.nativeElement as HTMLElement

        if (!autocompletePanel?.contains(relatedTarget)) {
            this.onAddChip(this.chipInputFormControl.value)
        }
    }

    onAutocompletePanelClosed(): void {
        this.chipInputFormControl.setValue('')
    }

    protected watchParentControl(): void {
        const parentNgControl = this.injector.get(NgControl, null)
        const parentControl = parentNgControl?.control

        if (parentControl) {
            const parentControlStatus$ = parentControl.statusChanges
                .pipe(
                    startWith(parentControl.status),
                    distinctUntilChanged(),
                )

            const chipsControlStatus$ = this.chipsFormControl.statusChanges
                .pipe(
                    startWith(this.chipsFormControl.status),
                    distinctUntilChanged(),
                )

            combineLatest([parentControlStatus$, chipsControlStatus$])
                .pipe(
                    // Wait for field to be updated
                    delay(0),
                    takeUntil(this.destroyed$),
                )
                .subscribe(() => {
                    if (parentControl.hasValidator(Validators.required)) {
                        this.required = true
                    }

                    this.chipsFormControl.setErrors(parentControl.errors)
                })
        }
    }

    protected watchChipsControl(): void {
        this.chipsFormControl.valueChanges
            .pipe(
                // we need to reformat values, as mat-chip-grid reformats  numbers back to strings
                map(values => EpicChipsAutocompleteFormControl.getFormattedValue(values, this.inputType)),
                distinctUntilChanged((left, right) => isEqual(left, right)),
                takeUntil(this.destroyed$),
            )
            .subscribe((valuesList) => {
                // Multiple Selection Allowed => Emit all values
                // Multiple Selection Disabled => Emit single value
                const resultValue = this.isMultipleSelection
                    ? valuesList
                    : (valuesList[0] ?? null)

                this.onChange(resultValue)
            })
    }

    protected watchFilteredOptions(): void {
        // Filter options that are not yet selected and match input's value
        combineLatest([
            this.chipsFormControl.valueChanges
                .pipe(
                    startWith(this.chipsFormControl.value),
                ),
            this.chipInputFormControl.valueChanges
                .pipe(
                    startWith(this.chipInputFormControl.value),
                ),
            this.options$,
        ])
            .pipe(
                distinctUntilChanged((left, right) => isEqual(left, right)),
                debounceTime(200),
                takeUntil(this.destroyed$),
            )
            .subscribe(([chips, preValue, options]) => {
                this.filteredOptions = EpicChipsAutocompleteFormControl.getFilteredOptions(
                    chips!,
                    preValue!,
                    options,
                )
            })
    }

}
