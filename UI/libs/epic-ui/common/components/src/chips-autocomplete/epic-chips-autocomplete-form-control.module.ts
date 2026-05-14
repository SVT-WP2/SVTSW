import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MatAutocompleteModule } from '@angular/material/autocomplete'
import { MatButtonModule } from '@angular/material/button'
import { MatChipsModule } from '@angular/material/chips'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatTooltipModule } from '@angular/material/tooltip'
import { TranslateModule } from '@ngx-translate/core'

import { EpicButtonModule } from '../button'
import { EpicIconComponent } from '../icon'
import { EpicLabelModule } from '../label'
import { EpicNoResultModule } from '../no-result'

import { EpicChipsAutocompleteFormControlComponent } from './epic-chips-autocomplete-form-control.component'


@NgModule({
    imports: [
        // NG
        CommonModule,
        ReactiveFormsModule,
        // 3rd
        FormsModule,
        TranslateModule,
        MatIconModule,
        MatAutocompleteModule,
        MatChipsModule,
        MatFormFieldModule,
        MatTooltipModule,
        MatButtonModule,
        // EPIC
        EpicIconComponent,
        EpicButtonModule,
        EpicNoResultModule,
        EpicLabelModule,
    ],
    declarations: [
        EpicChipsAutocompleteFormControlComponent,
    ],
    exports: [
        EpicChipsAutocompleteFormControlComponent,
    ],
})
export class EpicChipsAutocompleteFormControlModule {
}
