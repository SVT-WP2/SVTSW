import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MatSelectModule } from '@angular/material/select'
import { NgSelectModule } from '@ng-select/ng-select'
import { TranslateModule } from '@ngx-translate/core'

import { EpicLoaderComponent } from '../loader'
import { EpicSearchBoxModule } from '../search-box'

import { epicSelectComponents } from './components'
import { epicSelectDirectives } from './directives'


@NgModule({
    imports: [
        // NG
        CommonModule,
        FormsModule,
        ReactiveFormsModule,

        // EPIC
        TranslateModule,
        EpicSearchBoxModule,
        EpicLoaderComponent,

        // 3RD
        MatSelectModule,
        NgSelectModule,
    ],
    declarations: [
        ...epicSelectComponents,
        ...epicSelectDirectives,
    ],
    exports: [
        ...epicSelectComponents,
        ...epicSelectDirectives,
    ],
})
export class EpicSelectModule {
}
