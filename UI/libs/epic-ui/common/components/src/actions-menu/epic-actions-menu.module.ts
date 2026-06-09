import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatDividerModule } from '@angular/material/divider'
import { MatMenuModule } from '@angular/material/menu'
import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { EpicDefaultImageDirective } from 'epic-ui/utils'

import { EpicIconComponent } from '../icon'
import { EpicLoaderComponent } from '../loader'

import { EpicActionsMenuComponent } from './epic-actions-menu.component'


@NgModule({
    imports: [
        // NG
        CommonModule,
        RouterModule,
        // 3rd
        MatMenuModule,
        MatButtonModule,
        MatDividerModule,
        // EPIC
        TranslateModule,
        EpicLoaderComponent,
        EpicDefaultImageDirective,
        EpicIconComponent,
    ],
    declarations: [
        EpicActionsMenuComponent,
    ],
    exports: [
        EpicActionsMenuComponent,
    ],
})
export class EpicActionsMenuModule {
}
