import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatRippleModule } from '@angular/material/core'
import { MatDividerModule } from '@angular/material/divider'
import { MatMenuModule } from '@angular/material/menu'
import { MatSidenavModule } from '@angular/material/sidenav'
import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { EpicLongTextComponent, EpicTabsModule } from 'epic-ui/common/components'


import {
    EpicLayoutLightComponent,
    EpicLayoutLightHeaderActionsComponent,
    EpicLayoutLightHeaderNavigationComponent,
    EpicLayoutLightHeaderTitleComponent,
    EpicLayoutLightLogoComponent,
    EpicLayoutLightSectionContentComponent,
    EpicLayoutLightSectionSidebarBottomComponent,
    EpicLayoutLightSectionSidebarComponent,
    EpicLayoutLightSidePanelComponent,
} from './components'
import { EpicLayoutLightDynamicSectionDirective } from './directives'
import { EpicLayoutLightNotFoundPageComponent } from './pages'


@NgModule({
    imports: [
        // NG
        CommonModule,
        RouterModule,
        // 3rd
        MatButtonModule,
        MatMenuModule,
        MatDividerModule,
        MatRippleModule,
        MatSidenavModule,
        // EPIC
        TranslateModule,
        EpicLongTextComponent,
        EpicTabsModule,
    ],
    declarations: [
        EpicLayoutLightComponent,
        EpicLayoutLightSectionSidebarComponent,
        EpicLayoutLightSectionSidebarBottomComponent,
        EpicLayoutLightSectionContentComponent,
        EpicLayoutLightHeaderActionsComponent,
        EpicLayoutLightSidePanelComponent,
        EpicLayoutLightHeaderTitleComponent,
        EpicLayoutLightDynamicSectionDirective,
        EpicLayoutLightNotFoundPageComponent,
        EpicLayoutLightLogoComponent,
        EpicLayoutLightHeaderNavigationComponent,
    ],
    exports: [
        EpicLayoutLightComponent,
        EpicLayoutLightSectionSidebarComponent,
        EpicLayoutLightSectionSidebarBottomComponent,
        EpicLayoutLightSectionContentComponent,
        EpicLayoutLightHeaderActionsComponent,
        EpicLayoutLightHeaderTitleComponent,
        EpicLayoutLightSidePanelComponent,
        EpicLayoutLightDynamicSectionDirective,
        EpicLayoutLightNotFoundPageComponent,
        EpicLayoutLightLogoComponent,
        EpicLayoutLightHeaderNavigationComponent,
    ],
})
export class EpicLayoutLightModule {

}
