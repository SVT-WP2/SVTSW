import { Component, signal } from '@angular/core'

import { BaseFormControlComponent } from './base-form-control.component'


@Component({
    selector: 'epic-base-form-signal-value-control',
    template: '',
    standalone: false,
})
export abstract class BaseFormSignalValueControlComponent<TValue = unknown> extends BaseFormControlComponent<TValue> {

    readonly _value = signal<TValue>(null as unknown as TValue)

    get value(): TValue {
        return this._value()
    }

    set value(value: TValue) {
        this._value.set(value)
    }

}

