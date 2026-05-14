import { Component } from '@angular/core'

import { BaseFormControlComponent } from './base-form-control.component'


@Component({
    selector: 'epic-base-form-value-control',
    template: '',
    standalone: false,
})
export abstract class BaseFormValueControlComponent<TValue = unknown> extends BaseFormControlComponent<TValue> {

    _value: TValue

    get value(): TValue {
        return this._value
    }

    set value(value: TValue) {
        this._value = value
    }

}

