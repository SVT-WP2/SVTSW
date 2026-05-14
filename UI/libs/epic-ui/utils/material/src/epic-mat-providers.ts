import { Provider } from '@angular/core'
import { MAT_BUTTON_TOGGLE_DEFAULT_OPTIONS, MatButtonToggleDefaultOptions } from '@angular/material/button-toggle'
import { MAT_CHECKBOX_DEFAULT_OPTIONS, MatCheckboxDefaultOptions } from '@angular/material/checkbox'
import { MAT_CHIPS_DEFAULT_OPTIONS, MatChipsDefaultOptions } from '@angular/material/chips'
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialogConfig } from '@angular/material/dialog'
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldDefaultOptions } from '@angular/material/form-field'
import { MAT_RADIO_DEFAULT_OPTIONS, MatRadioDefaultOptions } from '@angular/material/radio'
import { MAT_SELECT_SCROLL_STRATEGY_PROVIDER } from '@angular/material/select'
import { MAT_SLIDE_TOGGLE_DEFAULT_OPTIONS, MatSlideToggleDefaultOptions } from '@angular/material/slide-toggle'
import { MAT_TOOLTIP_SCROLL_STRATEGY_FACTORY_PROVIDER } from '@angular/material/tooltip'


export function getEpicMatDefaultProviders(): Provider[] {
    return [
        {
            provide: MAT_BUTTON_TOGGLE_DEFAULT_OPTIONS,
            useValue: {
                hideSingleSelectionIndicator: true,
                hideMultipleSelectionIndicator: true,
            } as MatButtonToggleDefaultOptions,
        },
        {
            provide: MAT_CHECKBOX_DEFAULT_OPTIONS,
            useValue: {
                color: 'primary',
            } as MatCheckboxDefaultOptions,
        },
        {
            provide: MAT_RADIO_DEFAULT_OPTIONS,
            useValue: {
                color: 'primary',
            } as MatRadioDefaultOptions,
        },
        {
            provide: MAT_SLIDE_TOGGLE_DEFAULT_OPTIONS,
            useValue: {
                color: 'primary',
                hideIcon: true,
            } as MatSlideToggleDefaultOptions,
        },
        {
            provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
            useValue: {
                color: 'primary',
                appearance: 'fill',
                floatLabel: 'auto',
            } as MatFormFieldDefaultOptions,
        },
        {
            provide: MAT_DIALOG_DEFAULT_OPTIONS,
            useValue: {
                enterAnimationDuration: 0,
                exitAnimationDuration: 0,
            } as MatDialogConfig,
        },
        {
            provide: MAT_CHIPS_DEFAULT_OPTIONS,
            useValue: {
                hideSingleSelectionIndicator: true,
            } as MatChipsDefaultOptions,
        },
        MAT_TOOLTIP_SCROLL_STRATEGY_FACTORY_PROVIDER,
        MAT_SELECT_SCROLL_STRATEGY_PROVIDER,
    ]
}
