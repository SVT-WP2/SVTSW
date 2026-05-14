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
    EpicIconComponent,
    EpicBreadcrumbsModule,
    EpicButtonModule,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
    EpicLoaderComponent,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicAsicsListComponent } from 'epic-ui/shared/asics'
import { EpicKafkaSendMessageFormComponent } from 'epic-ui/shared/kafka'
import { EpicTcpSendMessageFormComponent } from 'epic-ui/shared/tcp'
import { EpicWaferAsicsListComponent, EpicWaferInfoComponent, EpicWafersListComponent } from 'epic-ui/shared/wafers'

import { EpicWafersRoutingModule } from './epic-wafers-routing.module'
import { EpicWafersListPageComponent } from './pages'


@NgModule({
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,

        MatFormField,
        MatInputModule,
        MatButton,
        MatCardModule,

        EpicWafersRoutingModule,
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
        EpicWaferInfoComponent,
        EpicAsicsListComponent,
        MatDivider,
        EpicWaferAsicsListComponent,
        EpicAgGridCardWrapperComponent,
        EpicAgGridCardHeaderComponent,
        MatMenu,
        MatMenuItem,
        MatMenuTrigger,
        EpicContentErrorMessagePipe,
    ],
    declarations: [
        EpicWafersListPageComponent,
    ],
    providers: [
    ],
})
export class EpicWafersModule {

}
