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
import { EpicAsicInfoComponent, EpicAsicIvMntGridComponent, EpicAsicsListComponent } from 'epic-ui/shared/asics'
import { EpicIvMntGridComponent } from 'epic-ui/shared/iv-mnt'
import { EpicKafkaSendMessageFormComponent } from 'epic-ui/shared/kafka'
import { EpicSvtDutTestsContainerComponent } from 'epic-ui/shared/svt-test/tests'
import { EpicTcpSendMessageFormComponent } from 'epic-ui/shared/tcp'
import { EpicWaferInfoComponent, EpicWafersListComponent } from 'epic-ui/shared/wafers'


import { EpicAsicsRoutingModule } from './epic-asics-routing.module'
import {
    EpicAsicDetailsPageComponent,
    EpicAsicSvtTestsPageComponent,
    EpicAsicUnderDevelopmentPageComponent,
    EpicAsicVoltageScanPageComponent,
} from './pages'


@NgModule({
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,

        MatFormField,
        MatInputModule,
        MatButton,
        MatCardModule,

        EpicAsicsRoutingModule,
        EpicKafkaSendMessageFormComponent,
        EpicTcpSendMessageFormComponent,
        EpicWafersListComponent,
        EpicLayoutLightModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicBreadcrumbsModule,
        EpicIconComponent,
        MatIconButton,
        EpicButtonModule,
        MatTooltip,
        EpicAsicsListComponent,
        EpicAgGridCardHeaderComponent,
        EpicAgGridCardWrapperComponent,
        EpicWaferInfoComponent,
        MatDivider,
        EpicAsicInfoComponent,
        MatMenu,
        MatMenuItem,
        MatMenuTrigger,
        EpicIvMntGridComponent,
        EpicTabsModule,
        EpicMatMenuContentComponent,
        EpicAsicIvMntGridComponent,
        EpicContentErrorMessagePipe,
        EpicIconMatOutlinedPipe,
        EpicSvtDutTestsContainerComponent,
    ],
    declarations: [
        EpicAsicDetailsPageComponent,
        EpicAsicVoltageScanPageComponent,
        EpicAsicSvtTestsPageComponent,
        EpicAsicUnderDevelopmentPageComponent,
    ],
})
export class EpicAsicsModule {

}
