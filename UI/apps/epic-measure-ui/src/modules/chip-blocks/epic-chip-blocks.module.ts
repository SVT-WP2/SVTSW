import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton, MatIconButton } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MatDivider } from '@angular/material/divider'
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu'
import { MatTooltip } from '@angular/material/tooltip'
import { RouterModule } from '@angular/router'
import {
    EpicBreadcrumbsModule,
    EpicButtonModule,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
    EpicIconComponent,
    EpicIconMatOutlinedPipe,
    EpicLoaderComponent, EpicMatMenuContentComponent, EpicTabsModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicChipBlockInfoComponent } from 'epic-ui/shared/chip-blocks'
import { EpicSvtDutTestsContainerComponent } from 'epic-ui/shared/svt-test/tests'


import { EpicChipBlocksRoutingModule } from './epic-chip-blocks-routing.module'
import { EpicChipBlockDetailsPageComponent } from './pages'


@NgModule({
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,

        MatButton,
        MatIconButton,
        MatCardModule,
        MatDivider,
        MatMenu,
        MatMenuItem,
        MatMenuTrigger,
        MatTooltip,

        EpicChipBlocksRoutingModule,
        EpicLayoutLightModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicContentErrorMessagePipe,
        EpicBreadcrumbsModule,
        EpicIconComponent,
        EpicIconMatOutlinedPipe,
        EpicButtonModule,

        EpicChipBlockInfoComponent,
        EpicSvtDutTestsContainerComponent,
        EpicMatMenuContentComponent,
        EpicTabsModule,
    ],
    declarations: [
        EpicChipBlockDetailsPageComponent,
    ],
})
export class EpicChipBlocksModule {

}
