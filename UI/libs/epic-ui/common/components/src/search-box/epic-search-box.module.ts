import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatAutocompleteModule } from '@angular/material/autocomplete'
import { MatProgressBarModule } from '@angular/material/progress-bar'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatTooltipModule } from '@angular/material/tooltip'
import { TranslateModule } from '@ngx-translate/core'
import { EpicIconComponent } from 'epic-ui/common/components'

import { EpicSearchBoxValueDirective } from './epic-search-box-value.directive'
import { EpicSearchBoxComponent } from './epic-search-box.component'


@NgModule({
    imports: [
        CommonModule,
        FormsModule,

        MatTooltipModule,
        MatAutocompleteModule,
        MatProgressSpinnerModule,
        MatProgressBarModule,

        TranslateModule,
        EpicIconComponent,
        EpicSearchBoxComponent,
        EpicSearchBoxValueDirective,
    ],
    exports: [
        EpicSearchBoxComponent,
        EpicSearchBoxValueDirective,
    ],
})
export class EpicSearchBoxModule {
}
