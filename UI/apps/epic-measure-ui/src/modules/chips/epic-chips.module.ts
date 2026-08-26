import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton, MatIconButton } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MatDivider } from '@angular/material/divider'
import { MatFormField } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu'
import { MatTooltip } from '@angular/material/tooltip'
import { RouterModule } from '@angular/router'
import { EpicAgGridCardHeaderComponent, EpicAgGridCardWrapperComponent } from 'epic-ui/common/ag-grid'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicIconMatOutlinedPipe,
    EpicLoaderComponent,
    EpicMatMenuContentComponent,
    EpicBreadcrumbsModule,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
    EpicTabsModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicAsicsListComponent } from 'epic-ui/shared/asics'
import { EpicChipInfoComponent } from 'epic-ui/shared/chips'
import { EpicIvMntGridComponent } from 'epic-ui/shared/iv-mnt'


import { EpicChipsRoutingModule } from './epic-chips-routing.module'
import { EpicChipDetailsPageComponent } from './pages'


@NgModule({
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,

        MatFormField,
        MatInputModule,
        MatButton,
        MatIconButton,
        MatCardModule,
        MatDivider,
        MatMenu,
        MatMenuItem,
        MatMenuTrigger,
        MatTooltip,

        EpicChipsRoutingModule,
        EpicLayoutLightModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicContentErrorMessagePipe,
        EpicBreadcrumbsModule,
        EpicIconComponent,
        EpicIconMatOutlinedPipe,
        EpicButtonModule,

        EpicAsicsListComponent,
        EpicAgGridCardHeaderComponent,
        EpicAgGridCardWrapperComponent,
        EpicChipInfoComponent,

        EpicIvMntGridComponent,
        EpicTabsModule,
        EpicMatMenuContentComponent,
    ],
    declarations: [
        EpicChipDetailsPageComponent,
    ],
})
export class EpicChipsModule {

}
