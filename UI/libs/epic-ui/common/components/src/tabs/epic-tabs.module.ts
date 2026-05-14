import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatBadgeModule } from '@angular/material/badge'
import { MatListModule } from '@angular/material/list'
import { MatMenuModule } from '@angular/material/menu'
import { MatTabsModule } from '@angular/material/tabs'
import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'

import { EpicIconComponent } from '../icon'
import { EpicMatMenuContentComponent } from '../mat-menu-content'

import {
    EpicHorizontalNavTabsComponent,
    EpicHorizontalTabsComponent,
    EpicVerticalNavTabsComponent,
    EpicVerticalTabsComponent,
} from './components'
import { EpicTabContentDirective } from './directives'


@NgModule({
    imports: [
        CommonModule,
        RouterModule,
        TranslateModule,

        MatListModule,
        MatMenuModule,
        MatTabsModule,
        MatBadgeModule,

        EpicMatMenuContentComponent,
        EpicIconComponent,
    ],
    declarations: [
        EpicVerticalTabsComponent,
        EpicHorizontalTabsComponent,
        EpicHorizontalNavTabsComponent,
        EpicVerticalNavTabsComponent,
        EpicTabContentDirective,
    ],
    exports: [
        EpicVerticalTabsComponent,
        EpicHorizontalTabsComponent,
        EpicHorizontalNavTabsComponent,
        EpicVerticalNavTabsComponent,
        EpicTabContentDirective,
    ],
})
export class EpicTabsModule {

}
