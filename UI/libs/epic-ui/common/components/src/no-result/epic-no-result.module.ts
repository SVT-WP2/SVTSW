import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatIconModule } from '@angular/material/icon'
import { TranslateModule } from '@ngx-translate/core'

import { EpicIconComponent } from '../icon'

import { EpicNoResultComponent } from './epic-no-result.component'


@NgModule({
    imports: [
        CommonModule,
        TranslateModule,
        MatIconModule,
        EpicIconComponent,
    ],
    declarations: [
        EpicNoResultComponent,
    ],
    exports: [
        EpicNoResultComponent,
    ],
})
export class EpicNoResultModule {
}
