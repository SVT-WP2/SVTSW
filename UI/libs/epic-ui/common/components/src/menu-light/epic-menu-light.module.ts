import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatBadgeModule } from '@angular/material/badge'
import { MatButtonModule } from '@angular/material/button'
import { MatDividerModule } from '@angular/material/divider'
import { MatMenuModule } from '@angular/material/menu'
import { MatTooltipModule } from '@angular/material/tooltip'
import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'

import { EpicButtonModule } from '../button'
import { EpicIconComponent } from '../icon'
import { EpicLongTextComponent } from '../long-text'
import { EpicMatMenuHeaderComponent } from '../mat-menu-header'

import { EpicMenuLightComponent, EpicMenuLightItemComponent, EpicMenuLightSubmenuComponent } from './components'
import { EpicMenuLightActiveItemDirective } from './directives'


@NgModule({
    imports: [
        //Ng
        CommonModule,
        TranslateModule,
        RouterModule,

        //3rd
        MatMenuModule,
        MatDividerModule,
        MatTooltipModule,
        MatButtonModule,
        MatBadgeModule,

        // Common
        EpicIconComponent,
        EpicMatMenuHeaderComponent,
        EpicLongTextComponent,
        EpicButtonModule,
    ],
    declarations: [
        EpicMenuLightComponent,
        EpicMenuLightItemComponent,
        EpicMenuLightSubmenuComponent,
        EpicMenuLightActiveItemDirective,
    ],
    exports: [
        EpicMenuLightComponent,
        EpicMenuLightActiveItemDirective,
    ],
})
export class EpicMenuLightModule {
}
