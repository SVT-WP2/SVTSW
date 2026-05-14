import { AfterViewInit, Component, Inject, INJECTOR, Injector, Input } from '@angular/core'
import { ControlValueAccessor, FormControl, NgControl, ValidationErrors } from '@angular/forms'
import { takeUntil } from 'rxjs/operators'

import { BaseComponent } from './base.component'


@Component({
    selector: 'epic-base-form-control',
    template: '',
    standalone: false,
})
export abstract class BaseFormControlComponent<TValue = unknown>
    extends BaseComponent implements ControlValueAccessor, AfterViewInit {

    @Input() errors: ValidationErrors | null
    @Input() disabled: boolean
    @Input() required: boolean
    @Input() readonly: boolean

    control: FormControl

    abstract value: TValue

    constructor(@Inject(INJECTOR) protected readonly injector: Injector,
    ) {
        super()
    }

    ngAfterViewInit(): void {
        this.initNgControl()
    }

    onChange: (value: TValue) => void = (value: TValue) => {
    }

    onTouch: () => void = () => {
    }

    onBlur(): void {
        this.onTouch()
    }

    registerOnChange(fn: any): void {
        this.onChange = fn
    }

    registerOnTouched(fn: any): void {
        this.onTouch = fn
    }

    writeValue(value: TValue): void {
        this.value = value
        this.onTouch()
    }

    setDisabledState(isDisabled: boolean): void {
        this.disabled = isDisabled
    }

    protected initNgControl(): void {
        const ngControl: NgControl | null = this.injector.get(NgControl, null, { self: true })

        if (ngControl) {
            this.control = ngControl.control as FormControl
            setTimeout(() => {
                ngControl.valueAccessor = this
                this.control.statusChanges
                    .pipe(
                        takeUntil(this.destroyed$),
                    )
                    .subscribe(
                        status => {
                            if (this.control.invalid) {
                                this.errors = this.control.errors
                            }
                            else {
                                this.errors = null
                            }
                        },
                    )
            })
        }
    }

}

