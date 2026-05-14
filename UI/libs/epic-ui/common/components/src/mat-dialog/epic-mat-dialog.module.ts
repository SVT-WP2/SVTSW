import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatDialogModule } from '@angular/material/dialog'
import { MatIconModule } from '@angular/material/icon'
import { MatTooltipModule } from '@angular/material/tooltip'
import { TranslateModule } from '@ngx-translate/core'

import { EpicButtonModule } from '../button'
import { EpicIconComponent } from '../icon'


import { epicDialogComponents } from './components'
import { epicDialogDirectives } from './directives'


@NgModule({
    declarations: [
        ...epicDialogComponents,
        ...epicDialogDirectives,
    ],
    imports: [
        CommonModule,
        TranslateModule,

        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,

        EpicButtonModule,
        EpicIconComponent,
    ],
    exports: [
        ...epicDialogComponents,
        ...epicDialogDirectives,
    ],
})
export class EpicMatDialogModule {
}
