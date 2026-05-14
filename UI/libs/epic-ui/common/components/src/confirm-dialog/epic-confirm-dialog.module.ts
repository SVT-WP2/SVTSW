import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatDialogModule } from '@angular/material/dialog'
import { MatIconModule } from '@angular/material/icon'
import { MatTooltipModule } from '@angular/material/tooltip'
import { TranslateModule } from '@ngx-translate/core'
import { EpicSafeHtmlPipe } from 'epic-ui/utils'

import { EpicMatDialogModule } from '../mat-dialog'

import { cockpitDialogComponents } from './components'


@NgModule({
    declarations: [
        ...cockpitDialogComponents,
    ],
    imports: [
        CommonModule,
        TranslateModule,

        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,

        EpicMatDialogModule,
        EpicSafeHtmlPipe,
    ],
    exports: [
        ...cockpitDialogComponents,
    ],
})
export class EpicConfirmDialogModule {
}
