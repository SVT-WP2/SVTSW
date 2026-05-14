import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatIconModule } from '@angular/material/icon'
import { TranslateModule } from '@ngx-translate/core'

import { EpicIconComponent, EpicIconMatOutlinedPipe } from '../icon'

import { EpicContentErrorComponent } from './epic-content-error.component'


@NgModule({
    declarations: [
        EpicContentErrorComponent,
    ],
    imports: [
        CommonModule,
        FormsModule,
        MatIconModule,
        TranslateModule,
        EpicIconComponent,
        EpicIconMatOutlinedPipe,
    ],
    exports: [EpicContentErrorComponent],
})
export class EpicContentErrorModule {
}
