import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatTooltipModule } from '@angular/material/tooltip'
import { TranslateModule } from '@ngx-translate/core'

import { EpicIconComponent } from '../icon'

import { EpicLabelComponent } from './components'
import { EpicLabelActionDirective } from './directives'


@NgModule({
    imports: [
        CommonModule,
        MatTooltipModule,
        TranslateModule,
        EpicIconComponent,
    ],
    declarations: [
        EpicLabelComponent,
        EpicLabelActionDirective,
    ],
    exports: [
        EpicLabelComponent,
        EpicLabelActionDirective,
    ],
})
export class EpicLabelModule {
}
