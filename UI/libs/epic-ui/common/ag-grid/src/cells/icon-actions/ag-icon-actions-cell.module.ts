import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatDividerModule } from '@angular/material/divider'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { MatTooltipModule } from '@angular/material/tooltip'
import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { EpicIconComponent, EpicActionsMenuModule, EpicButtonModule, EpicLoaderComponent } from 'epic-ui/common/components'


import { AgIconActionsCellComponent } from './ag-icon-actions-cell.component'


@NgModule({
    imports: [
        // NG
        CommonModule,
        RouterModule,
        // 3rd
        MatMenuModule,
        MatButtonModule,
        MatDividerModule,
        TranslateModule,
        // EPIC
        EpicLoaderComponent,
        EpicActionsMenuModule,
        EpicButtonModule,
        MatIconModule,
        MatTooltipModule,
        EpicIconComponent,
    ],
    declarations: [
        AgIconActionsCellComponent,
    ],
    exports: [
        AgIconActionsCellComponent,
    ],
})
export class AgIconActionsCellModule {
}
